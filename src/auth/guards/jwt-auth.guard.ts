import {

  CanActivate,

  ExecutionContext,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { RolesService } from '../../roles/roles.service';
import { UsersService } from '../../users/users.service';
import { UserRolesService } from '../../users/user-roles.service';
import { AuthCacheService } from '../auth-cache.service';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

import { decodeAccessToken } from '../utils/decode-token.util';

import { RequestUser } from '../interfaces/request-user.interface';



@Injectable()

export class JwtAuthGuard implements CanActivate {

  constructor(
    private readonly rolesService: RolesService,
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
    private readonly userRolesService: UserRolesService,
    private readonly authCache: AuthCacheService,
  ) {}



  async canActivate(context: ExecutionContext): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [

      context.getHandler(),

      context.getClass(),

    ]);

    if (isPublic) return true;



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



    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {

      throw new UnauthorizedException('Token expirado');

    }



    const sessionVersion =
      typeof payload.sv === 'number' ? payload.sv : 0;
    const userId = +payload.sub;

    let effective = this.authCache.get(userId, sessionVersion);
    if (!effective) {
      const currentSessionVersion =
        await this.usersService.getSessionVersion(userId);
      if (currentSessionVersion !== sessionVersion) {
        throw new UnauthorizedException(
          'Sesión invalidada. Inicie sesión nuevamente.',
        );
      }
      effective = await this.userRolesService.resolveEffectiveAuth(userId);
      this.authCache.set(userId, sessionVersion, effective);
    }

    const principalAssignment =
      effective.assignments.find((a) => a.esPrincipal) ?? effective.assignments[0];

    const user: RequestUser = {
      id: payload.sub,
      username: payload.username ?? '',
      nombre: payload.nombre,
      roles: effective.roleCodigos,
      permisos: effective.permisos,
      esAdmin: effective.esAdmin,
      ambitos: effective.ambitos,
      rolPrincipal: effective.primaryRole,
      institutionId: effective.institutionId,
      ugelCodigo: principalAssignment?.ugelCodigo ?? null,
      dreCodigo: principalAssignment?.dreCodigo ?? null,
    };



    req.user = user;

    return true;

  }

}


