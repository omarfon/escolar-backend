export const PERMISO_CURRICULA_VER = 'curricula.ver';
export const PERMISO_CURRICULA_GESTIONAR = 'curricula.gestionar';

export const PERMISOS_CURRICULA_LECTURA = [
  PERMISO_CURRICULA_VER,
  PERMISO_CURRICULA_GESTIONAR,
  'evaluacion.ver',
  'matricula.ver',
  'admin.institucional',
  'estudiantes.ver',
  'horarios.ver',
  'docentes.ver',
] as const;

export const PERMISOS_CURRICULA_GESTION = [
  PERMISO_CURRICULA_GESTIONAR,
  'admin.institucional',
] as const;
