// Redis caching layer for WorkTrack
// Uses in-memory cache as fallback when Redis is not available
// In production: set REDIS_URL env var to enable Redis

interface CacheEntry {
  data: any;
  expiresAt: number;
}

// In-memory cache (fallback for when Redis is not available)
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30_000; // 30 seconds default

export class Cache {
  private static redis: any = null;
  private static initialized = false;

  static async init() {
    if (this.initialized) return;
    this.initialized = true;

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        // Dynamic import to avoid dependency if not used
        const { createClient } = await import("redis");
        this.redis = createClient({ url: redisUrl });
        this.redis.on("error", (err: any) => console.error("[Redis] error:", err));
        await this.redis.connect();
        console.log("[Redis] connected");
      } catch (e) {
        console.log("[Redis] not available, using in-memory cache");
        this.redis = null;
      }
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    await this.init();

    if (this.redis) {
      try {
        const val = await this.redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        // Fall back to memory
      }
    }

    // In-memory cache
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static async set(key: string, data: any, ttlMs: number = CACHE_TTL): Promise<void> {
    await this.init();

    if (this.redis) {
      try {
        await this.redis.setEx(key, Math.floor(ttlMs / 1000), JSON.stringify(data));
        return;
      } catch {
        // Fall back to memory
      }
    }

    // In-memory cache
    memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });

    // Cleanup old entries periodically
    if (memoryCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of memoryCache) {
        if (v.expiresAt < now) memoryCache.delete(k);
      }
    }
  }

  static async delete(key: string): Promise<void> {
    await this.init();

    if (this.redis) {
      try { await this.redis.del(key); } catch {}
    }
    memoryCache.delete(key);
  }

  static async deletePattern(pattern: string): Promise<void> {
    await this.init();

    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) await this.redis.del(keys);
      } catch {}
    }

    // In-memory: delete matching keys
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) memoryCache.delete(key);
    }
  }

  // Helper: get or set pattern
  static async getOrSet<T>(key: string, ttlMs: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    await this.set(key, data, ttlMs);
    return data;
  }
}
