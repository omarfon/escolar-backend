import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  resolveTenantScopeFromRequest,
  TenantScopeOptions,
} from '../tenant-scope.util';

/**
 * Inyecta el institutionId resuelto según usuario y contexto tenant.
 *
 * @example
 * list(@TenantInstitution() institutionId: number) { ... }
 * listGlobal(@TenantInstitution({ mode: 'optional' }) institutionId?: number) { ... }
 */
export const TenantInstitution = createParamDecorator(
  (options: TenantScopeOptions | undefined, ctx: ExecutionContext): number | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return resolveTenantScopeFromRequest(req, options).institutionId;
  },
);
