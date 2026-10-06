import { BadRequestException } from '@nestjs/common';
import {
  assertRangoDentroAnioEscolar,
  esFinDeSemana,
  resolveCalendarioRango,
} from './calendario-date.util';

describe('calendario-date.util', () => {
  it('resuelve rango desde mes', () => {
    const rango = resolveCalendarioRango({ mes: '2026-03' });
    expect(rango.desde).toBe('2026-03-01');
    expect(rango.hasta).toBe('2026-03-31');
    expect(rango.mes).toBe('2026-03');
  });

  it('rechaza desde posterior a hasta', () => {
    expect(() =>
      resolveCalendarioRango({ desde: '2026-03-10', hasta: '2026-03-01' }),
    ).toThrow(BadRequestException);
  });

  it('detecta fin de semana', () => {
    expect(esFinDeSemana('2026-03-01')).toBe(true);
    expect(esFinDeSemana('2026-03-02')).toBe(false);
  });

  it('valida rango dentro del año escolar', () => {
    expect(() =>
      assertRangoDentroAnioEscolar('2026-01-01', '2026-01-31', '2026-03-01', '2026-12-20'),
    ).toThrow(BadRequestException);
  });
});
