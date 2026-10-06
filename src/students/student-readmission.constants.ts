export const PERMISO_REINGRESO_REGISTRAR = 'matricula.reingreso';
export const PERMISO_REINGRESO_CONSULTAR = 'matricula.ver';

export const MOTIVOS_REINGRESO = [
  'Retorno a la institución educativa',
  'Reincorporación por decisión familiar',
  'Mejora de situación económica',
  'Reincorporación por salud',
  'Error administrativo en retiro',
  'Otro',
] as const;

export type MotivoReingreso = (typeof MOTIVOS_REINGRESO)[number];

export const REINGRESO_AUTORIZACION_MIN = 10;
export const REINGRESO_AUTORIZACION_MAX = 800;
