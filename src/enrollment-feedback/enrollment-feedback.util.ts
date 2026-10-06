import {
  compareIsoDate,
  isIsoDate,
  minIsoDate,
  todayIso,
  yearEndIso,
  yearStartIso,
} from '../students/student-withdrawal.util';

export interface FechaRetroalimentacionWindow {
  fechaMin: string;
  fechaMax: string;
}

export function resolveFechaRetroalimentacionWindow(params: {
  anioEscolar: number;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  hoy?: string;
}): FechaRetroalimentacionWindow {
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

export function validateFechaRetroalimentacion(
  fecha: string,
  window: FechaRetroalimentacionWindow,
): string | null {
  if (!isIsoDate(fecha)) {
    return 'La fecha debe tener formato AAAA-MM-DD';
  }
  if (compareIsoDate(fecha, window.fechaMin) < 0) {
    return `La fecha no puede ser anterior al inicio del año escolar (${window.fechaMin})`;
  }
  if (compareIsoDate(fecha, window.fechaMax) > 0) {
    return `La fecha no puede ser posterior al periodo permitido (${window.fechaMax})`;
  }
  return null;
}
