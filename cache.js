/**
 * Lightweight TTL in-memory cache for frequently accessed REST endpoints
 * (skills catalog, job listings, analytics summaries) with prefix invalidation.
 */
class TtlCache {
  constructor() {
    this.store = new Map();
    this.metrics = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.metrics.misses += 1;
      return null;
    }
    this.metrics.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs = 30_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.metrics.sets += 1;
    return value;
  }

  invalidatePrefix(prefix) {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    this.metrics.invalidations += removed;
    return removed;
  }

  clear() {
    this.store.clear();
    this.metrics.invalidations += 1;
  }

  stats() {
    const now = Date.now();
    let activeKeys = 0;
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt > now) activeKeys += 1;
      else this.store.delete(k);
    }
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      activeKeys,
      hitRatePercent: total === 0 ? 0 : Math.round((this.metrics.hits / total) * 100),
    };
  }
}

export const cache = new TtlCache();
