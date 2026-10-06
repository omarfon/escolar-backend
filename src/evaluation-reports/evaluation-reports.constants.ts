export const EVALUATION_REPORT_TYPES = [
  'promedios',
  'notas',
  'competencias',
  'diagnostico',
] as const;

export type EvaluationReportType = (typeof EVALUATION_REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Por encima de este umbral la exportación se encola de forma asíncrona. */
export const ASYNC_EXPORT_ROW_THRESHOLD = 500;

/** Máximo de filas permitidas en exportación síncrona. */
export const SYNC_EXPORT_MAX_ROWS = 2_000;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Retención de archivos de jobs async (días). */
export const JOB_FILE_RETENTION_DAYS = 7;

export const REPORT_SOURCES: Record<EvaluationReportType, string> = {
  promedios: 'tabla_promedios',
  notas: 'tabla_grades',
  competencias: 'tabla_competency_evaluations',
  diagnostico: 'tabla_diagnostic_evaluations',
};
