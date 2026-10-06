export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function yearStartIso(anio: number): string {
  return `${anio}-01-01`;
}

export function yearEndIso(anio: number): string {
  return `${anio}-12-31`;
}

export function minIsoDate(...dates: string[]): string {
  return dates.filter(Boolean).sort()[0];
}

export function maxIsoDate(...dates: string[]): string {
  return dates.filter(Boolean).sort().at(-1) ?? dates[0];
}

export interface FechaRetiroWindow {
  fechaMin: string;
  fechaMax: string;
}

export function resolveFechaRetiroWindow(params: {
  anioEscolar: number;
  anioIngreso?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  hoy?: string;
}): FechaRetiroWindow {
  const hoy = params.hoy ?? todayIso();
  const ingresoYear = Number(params.anioIngreso);
  const ingresoStart =
    Number.isFinite(ingresoYear) && ingresoYear > 1900
      ? yearStartIso(ingresoYear)
      : yearStartIso(params.anioEscolar);

  const fechaMin = maxIsoDate(
    ingresoStart,
    params.periodoInicio?.trim() || yearStartIso(params.anioEscolar),
  );
  const fechaMax = minIsoDate(
    hoy,
    params.periodoFin?.trim() || yearEndIso(params.anioEscolar),
  );

  return {
    fechaMin,
    fechaMax: compareIsoDate(fechaMax, fechaMin) < 0 ? fechaMin : fechaMax,
  };
}

export function validateFechaRetiro(
  fechaRetiro: string,
  window: FechaRetiroWindow,
): string | null {
  if (!isIsoDate(fechaRetiro)) {
    return 'La fecha de retiro debe tener formato AAAA-MM-DD';
  }
  if (compareIsoDate(fechaRetiro, window.fechaMin) < 0) {
    return `La fecha de retiro no puede ser anterior a la matrícula vigente (${window.fechaMin})`;
  }
  if (compareIsoDate(fechaRetiro, window.fechaMax) > 0) {
    return `La fecha de retiro no puede ser posterior al periodo permitido (${window.fechaMax})`;
  }
  return null;
}
