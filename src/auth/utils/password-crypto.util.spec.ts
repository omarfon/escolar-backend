import {
  generateResetToken,
  hashPassword,
  hashResetToken,
  verifyPassword,
} from './password-crypto.util';

describe('password-crypto.util', () => {
  it('genera tokens únicos', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hashea y verifica contraseña scrypt', () => {
    const hashed = hashPassword('Clave1234');
    expect(hashed.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('Clave1234', hashed)).toBe(true);
    expect(verifyPassword('OtraClave1', hashed)).toBe(false);
  });

  it('soporta contraseñas legacy en texto plano', () => {
    expect(verifyPassword('admin123', 'admin123')).toBe(true);
  });

  it('hash de token es determinístico', () => {
    expect(hashResetToken('abc')).toEqual(hashResetToken('abc'));
  });
});
