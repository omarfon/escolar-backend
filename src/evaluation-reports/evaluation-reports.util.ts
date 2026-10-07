import type { EvaluationReportType } from './evaluation-reports.constants';

export interface ReportColumn {
  key: string;
  label: string;
}

export const REPORT_ROW_GROUP_HEADER = 'encabezado';
export const REPORT_ROW_DETAIL = 'detalle';

export interface ReportRow {
  /** encabezado = fila de título de alumno; detalle = fila de datos (solo reporte notas). */
  _tipoFila?: typeof REPORT_ROW_GROUP_HEADER | typeof REPORT_ROW_DETAIL | string;
  /** Texto del encabezado de grupo (nombre del estudiante). */
  tituloGrupo?: string;
  [key: string]: string | number | null | undefined;
}

export function isGroupHeaderRow(row: ReportRow): boolean {
  return row._tipoFila === REPORT_ROW_GROUP_HEADER;
}

export interface ReportPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ReportMetaInstitucion {
  id: number;
  nombre: string;
  siglas: string;
  dre: string;
  ugel: string;
  anioEscolar: number;
}

export interface ReportMetaAlcance {
  nivel: string;
  dre: string | null;
  ugel: string | null;
  label: string;
  consolidado: boolean;
  institucionesCount: number;
}

export interface ReportMeta {
  fechaCorte: string;
  anioEscolar: number;
  bimestre: number | null;
  tipo: EvaluationReportType | string;
  fuente: string;
  parametros: Record<string, unknown>;
  institucion: ReportMetaInstitucion;
  alcance?: ReportMetaAlcance;
  totales: Record<string, number | null>;
}

export function mergeTotales(
  base: Record<string, number | null>,
  add: Record<string, number | null>,
): Record<string, number | null> {
  const result = { ...base };
  for (const [key, value] of Object.entries(add)) {
    if (value == null) continue;
    if (result[key] == null) {
      result[key] = value;
      continue;
    }
    if (key.startsWith('promedio')) {
      result[key] = Math.round(((result[key]! + value) / 2) * 10) / 10;
    } else {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

export interface EvaluationReportResponse {
  meta: ReportMeta;
  columns: ReportColumn[];
  items: ReportRow[];
  pagination: ReportPagination;
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; pagination: ReportPagination } {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

export function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((row) => {
    if (isGroupHeaderRow(row)) {
      const title = row.tituloGrupo ?? row.estudiante ?? 'Estudiante';
      return csvCell(`— ${title} —`);
    }
    return columns.map((c) => csvCell(row[c.key] as string | number | null)).join(',');
  });
  return [header, ...body].join('\r\n');
}

export function matchesBusqueda(
  busqueda: string | undefined,
  ...values: Array<string | number | null | undefined>
): boolean {
  if (!busqueda) return true;
  const q = busqueda.toLowerCase();
  return values.some((v) => v != null && String(v).toLowerCase().includes(q));
}
