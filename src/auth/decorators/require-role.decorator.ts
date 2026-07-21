import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Requiere al menos uno de los roles indicados (OR). */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
