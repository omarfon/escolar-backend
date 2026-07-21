import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';
import { sanitizeAuditPayload } from '../audit-logs/audit-context.util';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { UserRole } from '../users/entities/user.entity';

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
    private readonly rolesService: RolesService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async login(dto: LoginDto, req: Request) {
    const user = await this.usersService.findByLogin(dto.username);
    if (!user || user.password !== dto.password) {
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

    const permisos = await this.rolesService.getPermissionsByRoleCodigo(user.rol);
    const roles = [user.rol] as UserRole[];
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400;
    const payload = {
      sub: String(user.id),
      username: user.email,
      nombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
      roles,
      iat: now,
      exp,
    };
    const b64 = (v: object) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock_signature`;

    this.auditLogger.logLogin(req, 'success', {
      usuarioId: user.id,
      usuarioNombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
      usuarioRol: user.rol,
    }, {
      ...(sanitizeAuditPayload({ username: user.username, email: user.email }) ?? {}),
      userAgent: req.headers['user-agent'] ?? '',
    });

    return {
      accessToken: token,
      refreshToken: `refresh_${user.id}_${now}`,
      expiresIn: 86400,
      tokenType: 'Bearer',
      user: this.buildAuthUser(user, permisos, roles),
    };
  }

  async getSession(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user || user.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    const permisos = await this.rolesService.getPermissionsByRoleCodigo(user.rol);
    const roles = [user.rol] as UserRole[];
    return {
      accessToken: null,
      refreshToken: null,
      expiresIn: 0,
      tokenType: 'Bearer',
      user: this.buildAuthUser(user, permisos, roles),
    };
  }

  async refreshFromToken(refreshToken: string, req: Request) {
    const match = refreshToken.match(/^refresh_(\d+)_/);
    if (!match) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    return this.refreshSession(+match[1], req);
  }

  async refreshSession(userId: number, req: Request) {
    const user = await this.usersService.findOne(userId);
    if (!user || user.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    const permisos = await this.rolesService.getPermissionsByRoleCodigo(user.rol);
    const roles = [user.rol] as UserRole[];
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 86400;
    const payload = {
      sub: String(user.id),
      username: user.email,
      nombre: `${user.nombres} ${user.apellidos}`.trim() || user.email,
      roles,
      iat: now,
      exp,
    };
    const b64 = (v: object) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock_signature`;

    return {
      accessToken: token,
      refreshToken: `refresh_${user.id}_${now}`,
      expiresIn: 86400,
      tokenType: 'Bearer',
      user: this.buildAuthUser(user, permisos, roles),
    };
  }

  private buildAuthUser(
    user: AuthUserSource,
    permisos: string[],
    roles: UserRole[],
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
      roles: roles.map((r) => ({ id: r, codigo: r, nombre: r, nivel: 1 })),
      permisos,
      institucionId: 'inst-001',
      estado: user.estado,
      ultimoAcceso: ultimo,
      requiereCambioPassword: false,
    };
  }
}
