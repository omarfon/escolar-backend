import {
  fechasDefectoAnioEscolar,
  periodosDentroDeAnioEscolar,
  plantillaPeriodosAnioEscolar,
  rangosSeSolapan,
} from './anio-escolar-periodos.util';

describe('anio-escolar-periodos.util', () => {
  it('genera bimestres dentro del rango por defecto', () => {
    const fechas = fechasDefectoAnioEscolar(2027);
    const periodos = plantillaPeriodosAnioEscolar(2027, 'bimestre');
    expect(periodos).toHaveLength(4);
    expect(periodosDentroDeAnioEscolar(periodos, fechas.fechaInicio, fechas.fechaFin)).toBe(true);
  });

  it('detecta solapamiento de rangos', () => {
    expect(rangosSeSolapan('2026-03-01', '2026-12-20', '2026-06-01', '2027-03-01')).toBe(true);
    expect(rangosSeSolapan('2026-03-01', '2026-05-01', '2026-06-01', '2026-12-01')).toBe(false);
  });

  it('genera trimestres dentro del rango por defecto', () => {
    const fechas = fechasDefectoAnioEscolar(2028);
    const periodos = plantillaPeriodosAnioEscolar(2028, 'trimestre');
    expect(periodos).toHaveLength(3);
    expect(periodosDentroDeAnioEscolar(periodos, fechas.fechaInicio, fechas.fechaFin)).toBe(true);
  });

  it('genera semestres dentro del rango por defecto', () => {
    const fechas = fechasDefectoAnioEscolar(2028);
    const periodos = plantillaPeriodosAnioEscolar(2028, 'semestre');
    expect(periodos).toHaveLength(2);
    expect(periodosDentroDeAnioEscolar(periodos, fechas.fechaInicio, fechas.fechaFin)).toBe(true);
  });
});
