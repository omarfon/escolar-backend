import type { InstitutionPeriodo } from '../../institution/entities/institution.entity';
import type { TipoPeriodoAnioEscolar } from './anio-escolar.constants';

/** Plantilla MINEDU-like de periodos por tipo de calendarización. */
export function plantillaPeriodosAnioEscolar(
  anio: number,
  tipo: TipoPeriodoAnioEscolar,
): InstitutionPeriodo[] {
  const y = String(anio);
  if (tipo === 'bimestre') {
    return [
      { numero: 1, nombre: '1 Bimestre', tipo, inicio: `${y}-03-10`, fin: `${y}-05-09`, actual: false },
      { numero: 2, nombre: '2 Bimestre', tipo, inicio: `${y}-05-12`, fin: `${y}-07-25`, actual: true },
      { numero: 3, nombre: '3 Bimestre', tipo, inicio: `${y}-08-11`, fin: `${y}-10-17`, actual: false },
      { numero: 4, nombre: '4 Bimestre', tipo, inicio: `${y}-10-20`, fin: `${y}-12-19`, actual: false },
    ];
  }
  if (tipo === 'trimestre') {
    return [
      { numero: 1, nombre: '1 Trimestre', tipo, inicio: `${y}-03-10`, fin: `${y}-06-20`, actual: false },
      { numero: 2, nombre: '2 Trimestre', tipo, inicio: `${y}-07-07`, fin: `${y}-09-26`, actual: true },
      { numero: 3, nombre: '3 Trimestre', tipo, inicio: `${y}-10-13`, fin: `${y}-12-19`, actual: false },
    ];
  }
  return [
    { numero: 1, nombre: '1 Semestre', tipo, inicio: `${y}-03-10`, fin: `${y}-07-25`, actual: false },
    { numero: 2, nombre: '2 Semestre', tipo, inicio: `${y}-08-11`, fin: `${y}-12-19`, actual: true },
  ];
}

export function fechasDefectoAnioEscolar(anio: number): { fechaInicio: string; fechaFin: string } {
  return {
    fechaInicio: `${anio}-03-01`,
    fechaFin: `${anio}-12-20`,
  };
}

export function periodosDentroDeAnioEscolar(
  periodos: InstitutionPeriodo[],
  fechaInicio: string,
  fechaFin: string,
): boolean {
  return periodos.every(
    (p) => p.inicio >= fechaInicio && p.fin <= fechaFin && p.inicio <= p.fin,
  );
}

export function rangosSeSolapan(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return aInicio <= bFin && bInicio <= aFin;
}
