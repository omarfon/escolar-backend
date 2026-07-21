import {

  CanActivate,

  ExecutionContext,

  ForbiddenException,

  Injectable,

} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { PERMISOS_KEY } from '../decorators/require-permiso.decorator';

import { RequestUser } from '../interfaces/request-user.interface';



@Injectable()

export class PermisoGuard implements CanActivate {

  constructor(private readonly reflector: Reflector) {}



  canActivate(context: ExecutionContext): boolean {

    const required = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [

      context.getHandler(),

      context.getClass(),

    ]);

    if (!required?.length) return true;



    const req = context.switchToHttp().getRequest();

    const user = req.user as RequestUser | undefined;

    if (!user) {

      throw new ForbiddenException('No autorizado');

    }

    if (user.esAdmin) return true;



    const hasAny = required.some((p) => user.permisos.includes(p));

    if (!hasAny) {

      throw new ForbiddenException(

        'No tiene permisos para realizar esta acción',

      );

    }



    return true;

  }

}


