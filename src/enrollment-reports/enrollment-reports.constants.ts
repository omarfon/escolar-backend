export const ENROLLMENT_REPORT_TYPES = [
  'matricula_global',
  'matricula_resumen',
] as const;

export type EnrollmentReportType = (typeof ENROLLMENT_REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;

export const ASYNC_EXPORT_ROW_THRESHOLD = 500;
export const SYNC_EXPORT_MAX_ROWS = 2_000;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const JOB_FILE_RETENTION_DAYS = 7;

export const ENROLLMENT_REPORT_SOURCES: Record<EnrollmentReportType, string> = {
  matricula_global: 'tabla_students',
  matricula_resumen: 'agregado_students_por_aula',
};

export const ESTADOS_MATRICULA = ['activo', 'inactivo', 'retirado'] as const;
