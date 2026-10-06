import { validatePasswordPolicy } from './password-policy.util';

describe('validatePasswordPolicy', () => {
  it('acepta contraseña que cumple política', () => {
    const result = validatePasswordPolicy('Clave1234');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rechaza contraseña corta', () => {
    const result = validatePasswordPolicy('Ab1');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rechaza sin mayúscula', () => {
    const result = validatePasswordPolicy('clave1234');
    expect(result.valid).toBe(false);
  });
});
