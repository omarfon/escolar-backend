export const PERMISO_RETROALIMENTACION_REGISTRAR =
  'matricula.retroalimentacion';
export const PERMISO_RETROALIMENTACION_CONSULTAR = 'matricula.ver';

export const CANALES_RETROALIMENTACION = [
  'Presencial',
  'Teléfono',
  'Correo electrónico',
  'Comunicado oficial',
  'Otro',
] as const;

export type CanalRetroalimentacion = (typeof CANALES_RETROALIMENTACION)[number];

export const RETROALIMENTACION_MENSAJE_MIN = 20;
export const RETROALIMENTACION_MENSAJE_MAX = 1000;
export const RETROALIMENTACION_DESTINATARIO_MAX = 120;
