import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { esSuperusuarioSiagie } from '../siagie-access.util';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class SiagieGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!esSuperusuarioSiagie(req.user)) {
      throw new ForbiddenException('Solo el usuario SIAGIE puede ver el directorio de instituciones');
    }
    return true;
  }
}
