import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { getClientIp } from '../audit-logs/audit-context.util';
import { Institution } from '../institution/entities/institution.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto, ForgotPasswordResponseDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, ResetPasswordResponseDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordRecoveryRateLimiterService } from './password-recovery-rate-limiter.service';
import {
  generateResetToken,
  hashPassword,
  hashResetToken,
  verifyPassword,
} from './utils/password-crypto.util';
import {
  DEFAULT_PASSWORD_POLICY,
  validatePasswordPolicy,
} from './utils/password-policy.util';

const GENERIC_FORGOT_MESSAGE =
  'Si el correo está registrado y activo, recibirá instrucciones para restablecer su contraseña.';
const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE_TOKENS_PER_USER = 3;

@Injectable()
export class PasswordRecoveryService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly auditLogger: AuditLoggerService,
    private readonly rateLimiter: PasswordRecoveryRateLimiterService,
    private readonly config: ConfigService,
  ) {}

  async getRecoveryContext() {
    const institucion = await this.loadPublicInstitutionContext();
    return {
      institucion,
      politicaPassword: DEFAULT_PASSWORD_POLICY,
      soporteEmail: this.config.get<string>('MAIL_REPLY_TO', ''),
    };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    req: Request,
    idempotencyKey?: string,
  ): Promise<ForgotPasswordResponseDto> {
    const ip = getClientIp(req);
    const email = dto.email.trim().toLowerCase();

    this.rateLimiter.assertAllowed(
      `forgot:ip:${ip}`,
      10,
      15 * 60 * 1000,
    );
    this.rateLimiter.assertAllowed(
      `forgot:email:${email}`,
      5,
      60 * 60 * 1000,
    );

    if (idempotencyKey?.trim()) {
      const existing = await this.tokenRepo.findOne({
        where: {
          idempotencyKey: idempotencyKey.trim(),
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        order: { createdAt: 'DESC' },
      });
      if (existing) {
        return { message: GENERIC_FORGOT_MESSAGE, accepted: true };
      }
    }

    const user = await this.usersService.findByEmail(email);

    if (user && user.estado === 'activo') {
      await this.invalidatePreviousTokens(user.id);
      const rawToken = generateResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await this.tokenRepo.save(
        this.tokenRepo.create({
          userId: user.id,
          tokenHash,
          expiresAt,
          requestIp: ip,
          idempotencyKey: idempotencyKey?.trim() || null,
        }),
      );

      const resetUrl = this.buildResetUrl(rawToken);
      const institucion = await this.loadPublicInstitutionContext();

      await this.mailService.sendPasswordResetEmail({
        to: user.email,
        nombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
        resetUrl,
        expiresMinutes: TOKEN_TTL_MS / 60_000,
        institucionNombre: institucion.nombre,
      });

      this.auditLogger.log({
        accion: 'configurar',
        modulo: 'autenticacion',
        entidad: 'password_reset',
        entidadId: String(user.id),
        descripcion: 'Solicitud de recuperación de contraseña',
        usuarioId: user.id,
        usuarioNombre: user.email,
        usuarioRol: user.rol,
        ip,
        detalle: { email: user.email, outcome: 'token_issued' },
      });
    } else {
      this.auditLogger.log({
        accion: 'consultar',
        modulo: 'autenticacion',
        entidad: 'password_reset',
        descripcion: 'Solicitud de recuperación de contraseña (sin acción)',
        usuarioId: null,
        usuarioNombre: email,
        usuarioRol: '',
        ip,
        detalle: { outcome: 'no_action' },
      });
    }

    return { message: GENERIC_FORGOT_MESSAGE, accepted: true };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    req: Request,
  ): Promise<ResetPasswordResponseDto> {
    const ip = getClientIp(req);
    this.rateLimiter.assertAllowed(`reset:ip:${ip}`, 15, 15 * 60 * 1000);

    if (dto.passwordNuevo !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const policy = validatePasswordPolicy(dto.passwordNuevo);
    if (!policy.valid) {
      throw new BadRequestException(policy.errors.join('. '));
    }

    const tokenHash = hashResetToken(dto.token.trim());
    const record = await this.tokenRepo.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      this.auditLogger.log({
        accion: 'actualizar',
        modulo: 'autenticacion',
        entidad: 'password_reset',
        descripcion: 'Intento de restablecimiento con token inválido o expirado',
        usuarioId: null,
        usuarioNombre: 'Anónimo',
        usuarioRol: '',
        ip,
        nivel: 'warning',
        detalle: { outcome: 'invalid_token' },
      });
      throw new BadRequestException(
        'El enlace de recuperación no es válido o ha expirado. Solicite uno nuevo.',
      );
    }

    const user = await this.usersService.findAuthUserById(record.userId);
    if (!user || user.estado !== 'activo') {
      throw new BadRequestException(
        'El enlace de recuperación no es válido o ha expirado. Solicite uno nuevo.',
      );
    }

    if (verifyPassword(dto.passwordNuevo, user.password)) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la anterior',
      );
    }

    await this.tokenRepo.manager.transaction(async (manager) => {
      record.usedAt = new Date();
      await manager.getRepository(PasswordResetToken).save(record);

      await manager.query(
        `UPDATE password_reset_tokens SET "usedAt" = now()
         WHERE "userId" = $1 AND "usedAt" IS NULL AND id <> $2`,
        [user.id, record.id],
      );

      const hashed = hashPassword(dto.passwordNuevo);
      await this.usersService.updatePasswordAndInvalidateSessions(
        user.id,
        hashed,
        manager,
      );
    });

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'autenticacion',
      entidad: 'usuario',
      entidadId: String(user.id),
      descripcion: 'Contraseña restablecida mediante recuperación',
      usuarioId: user.id,
      usuarioNombre: user.email,
      usuarioRol: user.rol,
      ip,
      detalle: {
        outcome: 'success',
        method: 'password_reset_token',
        sessionInvalidated: true,
      },
    });

    return {
      message: 'Contraseña actualizada correctamente. Inicie sesión con su nueva contraseña.',
      success: true,
    };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    req: Request,
  ): Promise<{ message: string }> {
    const ip = getClientIp(req);

    if (dto.passwordNuevo !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const policy = validatePasswordPolicy(dto.passwordNuevo);
    if (!policy.valid) {
      throw new BadRequestException(policy.errors.join('. '));
    }

    const user = await this.usersService.findAuthUserById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!verifyPassword(dto.passwordActual, user.password)) {
      this.auditLogger.log({
        accion: 'actualizar',
        modulo: 'autenticacion',
        entidad: 'usuario',
        entidadId: String(userId),
        descripcion: 'Cambio de contraseña fallido — contraseña actual incorrecta',
        usuarioId: userId,
        usuarioNombre: user.email,
        usuarioRol: user.rol,
        ip,
        nivel: 'warning',
      });
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    if (verifyPassword(dto.passwordNuevo, user.password)) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la anterior',
      );
    }

    const hashed = hashPassword(dto.passwordNuevo);
    await this.usersService.updatePasswordAndInvalidateSessions(user.id, hashed);

    this.auditLogger.log({
      accion: 'actualizar',
      modulo: 'autenticacion',
      entidad: 'usuario',
      entidadId: String(user.id),
      descripcion: 'Contraseña cambiada por el usuario autenticado',
      usuarioId: user.id,
      usuarioNombre: user.email,
      usuarioRol: user.rol,
      ip,
      detalle: { outcome: 'success', sessionInvalidated: true },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private async invalidatePreviousTokens(userId: number): Promise<void> {
    const active = await this.tokenRepo.find({
      where: { userId, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (active.length >= MAX_ACTIVE_TOKENS_PER_USER) {
      const toInvalidate = active.slice(MAX_ACTIVE_TOKENS_PER_USER - 1);
      for (const token of toInvalidate) {
        token.usedAt = new Date();
      }
      await this.tokenRepo.save(toInvalidate);
    }
  }

  private async loadPublicInstitutionContext() {
    let institution = await this.institutionRepo.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!institution) {
      institution = await this.institutionRepo.save(this.institutionRepo.create({}));
    }
    return {
      nombre: institution.nombre,
      siglas: institution.siglas,
      ruc: institution.ruc,
      codigoModular: institution.codigoModular,
      direccion: institution.direccion,
      anioEscolar: institution.anio,
      ugel: institution.ugel,
      dre: institution.dre,
    };
  }

  private buildResetUrl(rawToken: string): string {
    const base = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:4200')
      .replace(/\/$/, '');
    return `${base}/#/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  }
}
