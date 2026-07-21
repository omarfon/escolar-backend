import {

  CanActivate,

  ExecutionContext,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { RolesService } from '../../roles/roles.service';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

import { decodeAccessToken } from '../utils/decode-token.util';

import { RequestUser } from '../interfaces/request-user.interface';



@Injectable()

export class JwtAuthGuard implements CanActivate {

  constructor(

    private readonly rolesService: RolesService,

    private readonly reflector: Reflector,

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



    const roles = Array.isArray(payload.roles) ? payload.roles : [];

    const permisos = new Set<string>();

    let esAdmin = false;



    for (const rol of roles) {

      const list = await this.rolesService.getPermissionsByRoleCodigo(rol);

      list.forEach((p) => permisos.add(p));

      if (await this.rolesService.isAdminRole(rol)) {

        esAdmin = true;

      }

    }



    const user: RequestUser = {

      id: payload.sub,

      username: payload.username ?? '',

      nombre: payload.nombre,

      roles,

      permisos: [...permisos],

      esAdmin,

    };



    req.user = user;

    return true;

  }

}


