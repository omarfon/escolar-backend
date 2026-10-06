import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import {
  parseActorFromRequest,
  sanitizeAuditPayload,
} from '../audit-logs/audit-context.util';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { UserRolesService } from '../users/user-roles.service';
import { UserRole } from '../users/entities/user.entity';
import { verifyPassword } from './utils/password-crypto.util';

interface AuthUserSource {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  username: string;
  estado: string;
  ultimoAcceso?: Date | string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userRolesService: UserRolesService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async login(dto: LoginDto, req: Request) {
    const user = await this.usersService.findByLogin(dto.username);
    if (!user || !verifyPassword(dto.password, user.password)) {
      this.auditLogger.logLogin(req, 'error', {
        usuarioNombre: dto.username,
        usuarioRol: '',
      }, {
        username: dto.username,
        motivo: 'Credenciales inválidas',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.estado !== 'activo') {
      this.auditLogger.logLogin(req, 'error', {
        usuarioId: user.id,
        usuarioNombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
        usuarioRol: user.rol,
      }, {
        username: dto.username,
        motivo: 'Usuario inactivo o bloqueado',
      });
      throw new UnauthorizedException('Usuario inactivo o bloqueado');
    }

    await this.usersService.touchUltimoAcceso(user.id);

    const effective = await this.userRolesService.resolveEffectiveAuth(user.id);
    const roles = effective.roleCodigos;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400;
    const token = this.buildAccessToken(user, roles, now, exp, effective.institutionId);

    this.auditLogger.logLogin(req, 'success', {
      usuarioId: user.id,
      usuarioNombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
      usuarioRol: effective.primaryRole,
      institutionId: effective.institutionId,
    }, {
      ...(sanitizeAuditPayload({ username: user.username, email: user.email }) ?? {}),
      userAgent: req.headers['user-agent'] ?? '',
    });

    return {
      accessToken: token,
      refreshToken: `refresh_${user.id}_${now}`,
      expiresIn: 86400,
      tokenType: 'Bearer',
      user: this.buildAuthUser(user, effective),
    };
  }

  async getSession(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user || user.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    const authUser = await this.usersService.findAuthUserById(userId);
    const effective = await this.userRolesService.resolveEffectiveAuth(userId);
    return {
      accessToken: null,
      refreshToken: null,
      expiresIn: 0,
      tokenType: 'Bearer',
      user: this.buildAuthUser(
        authUser ?? {
          id: userId,
          nombres: user.nombres,
          apellidos: user.apellidos,
          email: user.email,
          username: user.username,
          estado: user.estado,
        },
        effective,
      ),
    };
  }

  logout(req: Request): { message: string } {
    const actor = parseActorFromRequest(req);
    this.auditLogger.logLogout(req, actor);
    return { message: 'Sesión cerrada correctamente' };
  }

  async refreshFromToken(refreshToken: string, req: Request) {
    const match = refreshToken.match(/^refresh_(\d+)_/);
    if (!match) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    return this.refreshSession(+match[1], req);
  }

  async refreshSession(userId: number, req: Request) {
    const user = await this.usersService.findAuthUserById(userId);
    if (!user || user.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    const effective = await this.userRolesService.resolveEffectiveAuth(user.id);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400;
    const token = this.buildAccessToken(
      user,
      effective.roleCodigos,
      now,
      exp,
      effective.institutionId,
    );

    return {
      accessToken: token,
      refreshToken: `refresh_${user.id}_${now}`,
      expiresIn: 86400,
      tokenType: 'Bearer',
      user: this.buildAuthUser(user as AuthUserSource, effective),
    };
  }

  buildAccessToken(
    user: AuthUserSource & { sessionVersion?: number },
    roles: UserRole[],
    iat: number,
    exp: number,
    institutionId?: number | null,
  ): string {
    const payload = {
      sub: String(user.id),
      username: user.email,
      nombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
      roles,
      institutionId: institutionId ?? null,
      sv: user.sessionVersion ?? 0,
      iat,
      exp,
    };
    const b64 = (v: object) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock_signature`;
  }

  private buildAuthUser(
    user: AuthUserSource,
    effective: Awaited<ReturnType<UserRolesService['resolveEffectiveAuth']>>,
  ) {
    const ultimo =
      user.ultimoAcceso instanceof Date
        ? user.ultimoAcceso.toISOString()
        : user.ultimoAcceso ?? new Date().toISOString();

    return {
      id: String(user.id),
      nombre: user.nombres,
      apellido: user.apellidos,
      email: user.email,
      username: user.username,
      roles: effective.roleCodigos.map((r) => ({
        id: r,
        codigo: r,
        nombre: r,
        nivel: r === effective.primaryRole ? 1 : 2,
      })),
      roleAssignments: effective.assignments,
      ambitos: effective.ambitos,
      rolPrincipal: effective.primaryRole,
      institutionId: effective.institutionId,
      permisos: effective.permisos,
      esAdmin: effective.esAdmin,
      estado: user.estado,
      ultimoAcceso: ultimo,
      requiereCambioPassword: false,
    };
  }
}
