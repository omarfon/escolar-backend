import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PREFIX = 'scrypt:';

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `${SCRYPT_PREFIX}${salt.toString('base64')}.${hash.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || !plain) return false;

  if (!stored.startsWith(SCRYPT_PREFIX)) {
    if (plain.length !== stored.length) return false;
    try {
      return timingSafeEqual(Buffer.from(plain), Buffer.from(stored));
    } catch {
      return plain === stored;
    }
  }

  const body = stored.slice(SCRYPT_PREFIX.length);
  const [saltB64, hashB64] = body.split('.');
  if (!saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(plain, salt, 64);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
