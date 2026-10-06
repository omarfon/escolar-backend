import {
  assertCurriculaEditable,
  assertNombreAreaValido,
  assertSinDuplicadoArea,
  normalizeAreaNombre,
} from './curricula-area.validation.util';

describe('curricula-area.validation.util', () => {
  it('normaliza espacios en el nombre', () => {
    expect(normalizeAreaNombre('  Matemática   ')).toBe('Matemática');
  });

  it('rechaza nombre corto', () => {
    expect(() => assertNombreAreaValido('A')).toThrow(/al menos 2 caracteres/);
  });

  it('acepta nombre válido', () => {
    expect(assertNombreAreaValido('Comunicación')).toBe('Comunicación');
  });

  it('detecta duplicado case-insensitive', () => {
    expect(() =>
      assertSinDuplicadoArea('comunicación', [{ nombre: 'Comunicación', activo: true }]),
    ).toThrow(/Ya existe un área activa/);
  });

  it('permite duplicado si el existente está inactivo', () => {
    expect(() =>
      assertSinDuplicadoArea('Comunicación', [{ nombre: 'Comunicación', activo: false }]),
    ).not.toThrow();
  });

  it('bloquea currícula inactiva', () => {
    expect(() => assertCurriculaEditable('inactivo')).toThrow(/currícula inactiva/);
  });
});
