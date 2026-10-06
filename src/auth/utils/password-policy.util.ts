export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: false,
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < policy.minLength) {
    errors.push(`La contraseña debe tener al menos ${policy.minLength} caracteres`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Debe incluir al menos una letra mayúscula');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Debe incluir al menos una letra minúscula');
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    errors.push('Debe incluir al menos un número');
  }
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Debe incluir al menos un carácter especial');
  }

  return { valid: errors.length === 0, errors };
}

export function assertPasswordsMatch(
  password: string,
  confirmPassword: string,
): void {
  if (password !== confirmPassword) {
    throw new Error('Las contraseñas no coinciden');
  }
}
