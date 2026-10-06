import { Injectable } from '@nestjs/common';
import { EffectiveUserAuth } from '../users/user-roles.service';

interface AuthCacheEntry {
  sessionVersion: number;
  effective: EffectiveUserAuth;
  expiresAt: number;
}

@Injectable()
export class AuthCacheService {
  private readonly ttlMs = 60_000;
  private readonly cache = new Map<number, AuthCacheEntry>();

  get(userId: number, sessionVersion: number): EffectiveUserAuth | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (entry.sessionVersion !== sessionVersion) {
      this.cache.delete(userId);
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }
    return entry.effective;
  }

  set(userId: number, sessionVersion: number, effective: EffectiveUserAuth): void {
    this.cache.set(userId, {
      sessionVersion,
      effective,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(userId: number): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}
