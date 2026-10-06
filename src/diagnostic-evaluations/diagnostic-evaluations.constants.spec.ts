import {
  isNivelLogroDiagnostico,
  NIVELES_LOGRO_DIAGNOSTICO,
} from './diagnostic-evaluations.constants';

describe('diagnostic-evaluations.constants', () => {
  it('valida niveles de logro permitidos', () => {
    for (const nivel of NIVELES_LOGRO_DIAGNOSTICO) {
      expect(isNivelLogroDiagnostico(nivel)).toBe(true);
    }
    expect(isNivelLogroDiagnostico('X')).toBe(false);
  });
});
