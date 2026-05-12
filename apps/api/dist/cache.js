const cacheStore = new Map();
export function getCached(key) {
    const entry = cacheStore.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        cacheStore.delete(key);
        return null;
    }
    return entry.value;
}
export function setCached(key, value, ttlSeconds) {
    cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
export function clearCache() {
    cacheStore.clear();
}
