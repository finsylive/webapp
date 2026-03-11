/**
 * Lightweight in-memory TTL cache.
 * Uses a Map with expiration timestamps — no external dependencies.
 * Designed for caching API responses on the server side.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number; // Unix timestamp in ms
}

const store = new Map<string, CacheEntry<unknown>>();

// Periodic cleanup of expired entries (every 60s)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (entry.expiresAt <= now) {
                store.delete(key);
            }
        }
        // Stop timer when cache is empty
        if (store.size === 0 && cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
    }, 60_000);
    // Don't block Node.js process exit
    if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
        cleanupTimer.unref();
    }
}

/**
 * Get a cached value by key. Returns undefined if not found or expired.
 */
export function cacheGet<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
    }
    return entry.value as T;
}

/**
 * Set a cached value with a TTL in seconds.
 */
export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
    ensureCleanup();
}

/**
 * Delete a specific cache key.
 */
export function cacheDel(key: string): boolean {
    return store.delete(key);
}

/**
 * Clear all cache entries matching a prefix.
 * Example: clearByPrefix('trending') clears 'trending:limit=5&offset=0', etc.
 */
export function cacheClearByPrefix(prefix: string): number {
    let count = 0;
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Clear cache entries matching a prefix that also contain a specific substring.
 * Example: cacheClearByMatch('startups', 'type=org_project') clears only org project list caches.
 */
export function cacheClearByMatch(prefix: string, match: string): number {
    let count = 0;
    for (const key of store.keys()) {
        if (key.startsWith(prefix) && key.includes(match)) {
            store.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Clear the entire cache.
 */
export function cacheClearAll(): number {
    const count = store.size;
    store.clear();
    return count;
}

/**
 * Get cache stats (for debugging).
 */
export function cacheStats(): { size: number; keys: string[] } {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.expiresAt <= now) store.delete(key);
    }
    return { size: store.size, keys: [...store.keys()] };
}
