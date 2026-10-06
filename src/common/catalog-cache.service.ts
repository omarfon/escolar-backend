import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/** Cache in-memory para catálogos de lectura frecuente (Redis opcional vía env en despliegues futuros). */
@Injectable()
export class CatalogCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs = Number(
    process.env.CATALOG_CACHE_TTL_MS ?? 300_000,
  );

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async wrap<T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }
}
