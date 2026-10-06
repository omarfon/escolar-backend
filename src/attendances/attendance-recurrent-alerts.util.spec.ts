import {
  calcPorcentajeInasistencia,
  evaluateRecurrentAbsenteeism,
  matchesNivelFilter,
} from './attendance-recurrent-alerts.util';

describe('attendance-recurrent-alerts.util', () => {
  const baseConfig = {
    diasAlertaAusentismo: 2,
    diasAlertaCritica: 5,
    porcentajeUmbral: 15,
    periodoTipo: 'mes' as const,
    nivelEducativo: '',
    modalidad: 'todos',
  };

  it('calcula porcentaje de inasistencia', () => {
    expect(calcPorcentajeInasistencia(3, 20)).toBe(15);
    expect(calcPorcentajeInasistencia(0, 0)).toBe(0);
  });

  it('dispara alerta por días consecutivos', () => {
    const result = evaluateRecurrentAbsenteeism(
      { faltasInjustificadas: 2, diasConsecutivos: 3, totalRegistrosBd: 10 },
      baseConfig,
    );
    expect(result.dispara).toBe(true);
    expect(result.nivel).toBe('alerta');
  });

  it('dispara crítico por umbral de días', () => {
    const result = evaluateRecurrentAbsenteeism(
      { faltasInjustificadas: 6, diasConsecutivos: 1, totalRegistrosBd: 20 },
      baseConfig,
    );
    expect(result.nivel).toBe('critico');
  });

  it('dispara alerta por porcentaje', () => {
    const result = evaluateRecurrentAbsenteeism(
      { faltasInjustificadas: 4, diasConsecutivos: 1, totalRegistrosBd: 20 },
      baseConfig,
    );
    expect(result.dispara).toBe(true);
    expect(result.porcentajeInasistencia).toBe(20);
  });

  it('no dispara con ausentismo bajo umbral', () => {
    const result = evaluateRecurrentAbsenteeism(
      { faltasInjustificadas: 1, diasConsecutivos: 1, totalRegistrosBd: 20 },
      baseConfig,
    );
    expect(result.dispara).toBe(false);
    expect(result.nivel).toBe('normal');
  });

  it('filtra por nivel educativo', () => {
    expect(matchesNivelFilter('Primaria', 'Primaria')).toBe(true);
    expect(matchesNivelFilter('Secundaria', 'Primaria')).toBe(false);
    expect(matchesNivelFilter('Primaria', '')).toBe(true);
  });
});
