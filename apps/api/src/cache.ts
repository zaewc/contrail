interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlSeconds: number): void {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function clearCache(): void {
  cacheStore.clear();
}
