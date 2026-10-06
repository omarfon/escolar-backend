import {
  labelTipoEscala,
  modalidadFromSistemaEval,
  modalidadFromTipoEscala,
  validateEscalaLogro,
  validateNotaMinima,
} from './grading-scale-config.util';

describe('grading-scale-config.util', () => {
  it('mapea modalidad institucional', () => {
    expect(modalidadFromSistemaEval('numerico')).toBe('cuantitativa');
    expect(modalidadFromSistemaEval('literal')).toBe('cualitativa');
    expect(modalidadFromSistemaEval('mixto')).toBe('mixta');
  });

  it('mapea modalidad por tipo de currícula', () => {
    expect(modalidadFromTipoEscala('numerica')).toBe('cuantitativa');
    expect(modalidadFromTipoEscala('competencia')).toBe('cualitativa');
  });

  it('valida escala logro ordenada', () => {
    expect(validateEscalaLogro({ AD: 17.5, A: 14, B: 11 }, 11)).toBeNull();
    expect(validateEscalaLogro({ AD: 14, A: 17, B: 11 }, 11)).toContain('AD');
    expect(validateEscalaLogro({ AD: 17, A: 14, B: 10 }, 11)).toContain('nota mínima');
  });

  it('valida nota mínima en rango', () => {
    expect(validateNotaMinima(11)).toBeNull();
    expect(validateNotaMinima(21)).toContain('0 y 20');
  });

  it('genera etiqueta de tipo de escala', () => {
    expect(labelTipoEscala('numerica')).toContain('Cuantitativa');
    expect(labelTipoEscala('competencia')).toContain('Cualitativa');
  });
});
