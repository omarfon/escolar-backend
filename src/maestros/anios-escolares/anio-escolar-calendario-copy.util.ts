import { rangosSeSolapan } from './anio-escolar-periodos.util';

export interface CopiarCalendarioResumen {
  copiados: number;
  omitidos: number;
  fueraDeRango: number;
}

export interface CopiarCalendarioResultado {
  anioDestino: number;
  anioOrigen: number;
  deltaAnios: number;
  periodos: CopiarCalendarioResumen;
  feriados: CopiarCalendarioResumen;
  eventos: CopiarCalendarioResumen;
  version: number;
  recuperado?: boolean;
  mensaje: string;
}

/** Desplaza una fecha ISO (YYYY-MM-DD) sumando años calendario. */
export function desplazarFechaIso(fecha: string, deltaAnios: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const year = Number(m[1]) + deltaAnios;
  const candidate = `${year}-${m[2]}-${m[3]}`;
  const parsed = new Date(`${candidate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const iso = parsed.toISOString().slice(0, 10);
  return iso === candidate ? candidate : null;
}

export function fechaEnRangoAnioEscolar(
  fecha: string,
  fechaInicio: string,
  fechaFin: string,
): boolean {
  return fecha >= fechaInicio && fecha <= fechaFin;
}

export function anioDeFechaIso(fecha: string): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(fecha);
  return m ? Number(m[1]) : null;
}

export interface PeriodoRango {
  numero: number;
  inicio: string;
  fin: string;
}

/** Indica si un periodo propuesto se solapa con alguno existente (mismo número excluido). */
export function periodoSolapaExistentes(
  propuesto: PeriodoRango,
  existentes: PeriodoRango[],
): boolean {
  for (const ex of existentes) {
    if (ex.numero === propuesto.numero) continue;
    if (rangosSeSolapan(propuesto.inicio, propuesto.fin, ex.inicio, ex.fin)) {
      return true;
    }
  }
  return false;
}

export function construirMensajeCopiaCalendario(res: Omit<CopiarCalendarioResultado, 'mensaje'>): string {
  const total =
    res.periodos.copiados + res.feriados.copiados + res.eventos.copiados;
  if (total === 0) {
    return `No se copió ningún elemento del año ${res.anioOrigen} al ${res.anioDestino}.`;
  }
  return `Calendario copiado del ${res.anioOrigen} al ${res.anioDestino}: ${total} elemento(s) nuevo(s).`;
}
