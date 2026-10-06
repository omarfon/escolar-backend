import {
  compareIsoDate,
  isIsoDate,
  minIsoDate,
  todayIso,
  yearEndIso,
  yearStartIso,
} from './student-withdrawal.util';

export interface FechaReingresoWindow {
  fechaMin: string;
  fechaMax: string;
}

export function resolveFechaReingresoWindow(params: {
  fechaRetiro: string;
  anioEscolar: number;
  periodoFin?: string | null;
  hoy?: string;
}): FechaReingresoWindow {
  const hoy = params.hoy ?? todayIso();
  const fechaMin = params.fechaRetiro.trim();
  const fechaMax = minIsoDate(
    hoy,
    params.periodoFin?.trim() || yearEndIso(params.anioEscolar),
  );

  return {
    fechaMin,
    fechaMax: compareIsoDate(fechaMax, fechaMin) < 0 ? fechaMin : fechaMax,
  };
}

export function resolveFechaReingresoContextWindow(params: {
  anioEscolar: number;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  hoy?: string;
}): FechaReingresoWindow {
  const hoy = params.hoy ?? todayIso();
  const fechaMin =
    params.periodoInicio?.trim() || yearStartIso(params.anioEscolar);
  const fechaMax = minIsoDate(
    hoy,
    params.periodoFin?.trim() || yearEndIso(params.anioEscolar),
  );

  return {
    fechaMin,
    fechaMax: compareIsoDate(fechaMax, fechaMin) < 0 ? fechaMin : fechaMax,
  };
}

export function validateFechaReingreso(
  fechaReingreso: string,
  window: FechaReingresoWindow,
): string | null {
  if (!isIsoDate(fechaReingreso)) {
    return 'La fecha de reingreso debe tener formato AAAA-MM-DD';
  }
  if (compareIsoDate(fechaReingreso, window.fechaMin) < 0) {
    return `La fecha de reingreso no puede ser anterior al retiro (${window.fechaMin})`;
  }
  if (compareIsoDate(fechaReingreso, window.fechaMax) > 0) {
    return `La fecha de reingreso no puede ser posterior al periodo permitido (${window.fechaMax})`;
  }
  return null;
}
