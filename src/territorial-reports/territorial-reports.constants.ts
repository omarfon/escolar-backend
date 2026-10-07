export const TERRITORIAL_REPORT_TYPES = ['consolidado_ugel_dre'] as const;
export type TerritorialReportType = (typeof TERRITORIAL_REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const SYNC_EXPORT_MAX_ROWS = 2_000;

export const REPORT_SOURCE = 'agregado_territorial_matricula_asistencia_evaluacion';
