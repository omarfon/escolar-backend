import {
  compareIsoDate,
  isIsoDate,
  minIsoDate,
  todayIso,
  yearEndIso,
  yearStartIso,
} from '../students/student-withdrawal.util';

export interface FechaEvaluacionWindow {
  fechaMin: string;
  fechaMax: string;
}

export function resolveFechaEvaluacionWindow(params: {
  anioEscolar: number;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  hoy?: string;
}): FechaEvaluacionWindow {
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

export function validateFechaEvaluacion(
  fechaEvaluacion: string,
  window: FechaEvaluacionWindow,
): string | null {
  if (!isIsoDate(fechaEvaluacion)) {
    return 'La fecha de evaluación debe tener formato AAAA-MM-DD';
  }
  if (compareIsoDate(fechaEvaluacion, window.fechaMin) < 0) {
    return `La fecha no puede ser anterior al inicio del año escolar (${window.fechaMin})`;
  }
  if (compareIsoDate(fechaEvaluacion, window.fechaMax) > 0) {
    return `La fecha no puede ser posterior al periodo permitido (${window.fechaMax})`;
  }
  return null;
}
