export const TIPOS_VINCULO = [
  'padre',
  'madre',
  'apoderado',
  'abuelo',
  'tio',
  'hermano',
  'otro',
] as const;

export type TipoVinculo = (typeof TIPOS_VINCULO)[number];

export const PERMISO_VINCULOS_VER = 'estudiantes.representantes';
export const PERMISO_VINCULOS_GESTIONAR = 'estudiantes.representantes';
