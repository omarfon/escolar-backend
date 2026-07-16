import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

export const RequirePermiso = (...permisos: string[]) =>
  SetMetadata(PERMISOS_KEY, permisos);
