import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-role.decorator';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
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

    const ok = required.some((r) => user.roles.includes(r));
    if (!ok) {
      throw new ForbiddenException('No tiene el rol requerido para esta acción');
    }
    return true;
  }
}
