export const ATTENDANCE_REPORT_TYPES = [
  'asistencia_detalle',
  'asistencia_resumen',
] as const;

export type AttendanceReportType = (typeof ATTENDANCE_REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const ASYNC_EXPORT_ROW_THRESHOLD = 500;
export const SYNC_EXPORT_MAX_ROWS = 2_000;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const JOB_FILE_RETENTION_DAYS = 7;

export const ATTENDANCE_REPORT_SOURCES: Record<AttendanceReportType, string> = {
  asistencia_detalle: 'tabla_attendances',
  asistencia_resumen: 'agregado_attendances_por_estudiante',
};

export const ESTADOS_ASISTENCIA = ['P', 'F', 'T', 'J'] as const;

export const ESTADO_ASISTENCIA_LABEL: Record<string, string> = {
  P: 'Presente',
  F: 'Falta',
  T: 'Tardanza',
  J: 'Justificada',
};
