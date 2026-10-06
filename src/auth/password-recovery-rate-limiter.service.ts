import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface WindowCounter {
  count: number;
  resetAt: number;
}

@Injectable()
export class PasswordRecoveryRateLimiterService {
  private readonly windows = new Map<string, WindowCounter>();

  assertAllowed(
    key: string,
    maxAttempts: number,
    windowMs: number,
    message = 'Demasiados intentos. Intente nuevamente más tarde.',
  ): void {
    const now = Date.now();
    const current = this.windows.get(key);

    if (!current || now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (current.count >= maxAttempts) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
