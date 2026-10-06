import {
  calcPromedioNivel,
  gradosCoinciden,
} from './competency-evaluations.util';

describe('competency-evaluations.util', () => {
  describe('gradosCoinciden', () => {
    it('empareja grado institucional con valor de matrícula', () => {
      expect(gradosCoinciden('Primaria', '4° Grado', '4°')).toBe(true);
      expect(gradosCoinciden('Secundaria', '1° Año', '1°')).toBe(true);
    });

    it('rechaza grados distintos', () => {
      expect(gradosCoinciden('Primaria', '4°', '5°')).toBe(false);
    });
  });

  describe('calcPromedioNivel', () => {
    it('calcula promedio cualitativo', () => {
      expect(calcPromedioNivel(['A', 'A', 'B'])).toBe('A');
      expect(calcPromedioNivel(['AD', 'AD'])).toBe('AD');
      expect(calcPromedioNivel(['C'])).toBe('C');
    });

    it('retorna null sin valores', () => {
      expect(calcPromedioNivel([])).toBeNull();
    });
  });
});
