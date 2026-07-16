import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RolesService } from '../../roles/roles.service';
import { decodeAccessToken } from '../utils/decode-token.util';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly rolesService: RolesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    const token = header.slice(7).trim();
    const payload = decodeAccessToken(token);
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const permisos = new Set<string>();
    for (const rol of roles) {
      const list = await this.rolesService.getPermissionsByRoleCodigo(rol);
      list.forEach((p) => permisos.add(p));
    }

    const user: RequestUser = {
      id: payload.sub,
      username: payload.username ?? '',
      roles,
      permisos: [...permisos],
    };

    req.user = user;
    return true;
  }
}
