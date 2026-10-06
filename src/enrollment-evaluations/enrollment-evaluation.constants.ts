export const PERMISO_EVALUACION_MATRICULA_REGISTRAR = 'matricula.evaluacion';
export const PERMISO_EVALUACION_MATRICULA_CONSULTAR = 'matricula.ver';

export const TIPOS_EVALUACION_MATRICULA = [
  'Entrevista con apoderado',
  'Examen de admisión',
  'Revisión de documentos',
  'Observación en aula',
  'Evaluación psicopedagógica',
  'Otro',
] as const;

export type TipoEvaluacionMatricula =
  (typeof TIPOS_EVALUACION_MATRICULA)[number];

export const RESULTADOS_EVALUACION_MATRICULA = [
  'aprobado',
  'aprobado_condicionado',
  'rechazado',
  'observado',
] as const;

export type ResultadoEvaluacionMatricula =
  (typeof RESULTADOS_EVALUACION_MATRICULA)[number];

export const RESULTADO_EVALUACION_LABELS: Record<
  ResultadoEvaluacionMatricula,
  string
> = {
  aprobado: 'Aprobado',
  aprobado_condicionado: 'Aprobado condicionado',
  rechazado: 'Rechazado',
  observado: 'Observado',
};

export const EVALUACION_RESOLUCION_MIN = 10;
export const EVALUACION_RESOLUCION_MAX = 800;
export const EVALUACION_OBSERVACIONES_MAX = 500;
export const EVALUACION_PUNTAJE_MIN = 0;
export const EVALUACION_PUNTAJE_MAX = 20;
