import {
  computeGlobalAvancePct,
  computeNotasAvanceMetrics,
} from './evaluation-reports-avance.util';

describe('evaluation-reports-avance.util', () => {
  it('computeNotasAvanceMetrics calcula avance por curso', () => {
    const result = computeNotasAvanceMetrics(
      [
        { componentesRegistrados: 3 },
        { componentesRegistrados: 2 },
        { componentesRegistrados: 0 },
      ],
      3,
    );
    expect(result.componentesEsperados).toBe(9);
    expect(result.componentesRegistrados).toBe(5);
    expect(result.avancePct).toBe(55.6);
    expect(result.alumnosCompletos).toBe(1);
    expect(result.alumnosPendientes).toBe(2);
  });

  it('computeGlobalAvancePct retorna null si no hay esperados', () => {
    expect(computeGlobalAvancePct(0, 0)).toBeNull();
    expect(computeGlobalAvancePct(5, 10)).toBe(50);
  });
});
