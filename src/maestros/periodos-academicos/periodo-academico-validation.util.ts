import { periodoSolapaExistentes } from '../anios-escolares/anio-escolar-calendario-copy.util';
import { periodosDentroDeAnioEscolar } from '../anios-escolares/anio-escolar-periodos.util';
import type { InstitutionPeriodo } from '../../institution/entities/institution.entity';

export interface PeriodoRangoValidacion {
  numero: number;
  inicio: string;
  fin: string;
}

export function assertFechasOrdenadas(inicio: string, fin: string): void {
  if (fin < inicio) {
    throw new Error('La fecha de fin no puede ser anterior al inicio');
  }
}

export function assertPeriodoDentroDeAnioEscolar(
  inicio: string,
  fin: string,
  fechaInicioAnio: string,
  fechaFinAnio: string,
): void {
  if (inicio < fechaInicioAnio || fin > fechaFinAnio) {
    throw new Error(
      `Las fechas del periodo deben estar dentro del año escolar (${fechaInicioAnio} – ${fechaFinAnio}).`,
    );
  }
}

export function assertSinSolapamientoPeriodo(
  propuesto: PeriodoRangoValidacion,
  existentes: PeriodoRangoValidacion[],
): void {
  if (periodoSolapaExistentes(propuesto, existentes)) {
    throw new Error('El periodo se solapa con otro periodo del mismo año escolar.');
  }
}

export function plantillaCoincideConExistentes(
  plantilla: InstitutionPeriodo[],
  existentes: Array<{ numero: number; inicio: string; fin: string; tipo: string; nombre: string }>,
): boolean {
  const activos = existentes.filter((e) => e);
  if (activos.length !== plantilla.length) return false;
  return plantilla.every((p) => {
    const ex = activos.find((e) => e.numero === p.numero);
    return (
      !!ex &&
      ex.inicio === p.inicio &&
      ex.fin === p.fin &&
      ex.tipo === p.tipo &&
      ex.nombre === p.nombre
    );
  });
}

export function assertPlantillaDentroDeAnio(
  plantilla: InstitutionPeriodo[],
  fechaInicio: string,
  fechaFin: string,
): void {
  if (!periodosDentroDeAnioEscolar(plantilla, fechaInicio, fechaFin)) {
    throw new Error('La plantilla de periodos no cabe dentro del rango del año escolar.');
  }
}
