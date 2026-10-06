import {
  assertPeriodoDentroDeAnioEscolar,
  assertSinSolapamientoPeriodo,
  plantillaCoincideConExistentes,
} from './periodo-academico-validation.util';
import { plantillaPeriodosAnioEscolar } from '../anios-escolares/anio-escolar-periodos.util';

describe('periodo-academico-validation.util', () => {
  it('rechaza periodo fuera del año escolar', () => {
    expect(() =>
      assertPeriodoDentroDeAnioEscolar('2027-01-01', '2027-02-01', '2027-03-01', '2027-12-20'),
    ).toThrow(/dentro del año escolar/);
  });

  it('detecta solapamiento entre periodos', () => {
    expect(() =>
      assertSinSolapamientoPeriodo(
        { numero: 3, inicio: '2027-05-01', fin: '2027-06-01' },
        [{ numero: 2, inicio: '2027-03-10', fin: '2027-05-15' }],
      ),
    ).toThrow(/solapa/);
  });

  it('coincide plantilla con existentes', () => {
    const plantilla = plantillaPeriodosAnioEscolar(2028, 'trimestre');
    const existentes = plantilla.map((p) => ({
      numero: p.numero,
      inicio: p.inicio,
      fin: p.fin,
      tipo: p.tipo,
      nombre: p.nombre,
    }));
    expect(plantillaCoincideConExistentes(plantilla, existentes)).toBe(true);
  });
});
