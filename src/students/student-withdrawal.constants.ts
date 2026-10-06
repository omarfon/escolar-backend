export const PERMISO_RETIRO_REGISTRAR = 'matricula.retiro';
export const PERMISO_RETIRO_CONSULTAR = 'matricula.ver';

export const MOTIVOS_RETIRO = [
  'Traslado a otra institución educativa',
  'Cambio de domicilio',
  'Motivos económicos',
  'Motivos de salud',
  'Decisión familiar',
  'Fallecimiento',
  'Otro',
] as const;

export type MotivoRetiro = (typeof MOTIVOS_RETIRO)[number];

export const RETIRO_SUSTENTO_MIN = 10;
export const RETIRO_SUSTENTO_MAX = 800;
