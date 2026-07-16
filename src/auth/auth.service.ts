import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByLogin(dto.username);
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.estado !== 'activo') {
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
      user: {
        id: String(user.id),
        nombre: user.nombres,
        apellido: user.apellidos,
        email: user.email,
        username: user.username,
        roles: roles.map((r) => ({ id: r, codigo: r, nombre: r, nivel: 1 })),
        permisos,
        institucionId: 'inst-001',
        estado: user.estado,
        ultimoAcceso: new Date().toISOString(),
        requiereCambioPassword: false,
      },
    };
  }
}
