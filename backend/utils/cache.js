/**
 * utils/cache.js
 * A simple caching utility that supports in-memory (Map) or Redis (logic ready).
 */

const memoryCache = new Map();

// Helper to determine if we should use Redis (if configured in process.env)
const isRedisEnabled = () => !!process.env.REDIS_URL;

// When DISABLE_CACHE=true (set by integration test setupFiles) all reads return
// null and all writes are skipped. process.env is shared across every require()
// in the same process, so this reliably affects the controller's cache calls too.
const isCacheDisabled = () => process.env.DISABLE_CACHE === 'true';

const cache = {
  get: async (key) => {
    if (isCacheDisabled()) return null;
    if (isRedisEnabled()) {
      // Mock Redis GET
      // const client = require('../config/redis');
      // return await client.get(key);
    }
    const entry = memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.expiry) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  },

  set: async (key, value, ttlSeconds = 300) => {
    if (isCacheDisabled()) return;
    if (isRedisEnabled()) {
      // Mock Redis SET
      // await client.set(key, value, 'EX', ttlSeconds);
    }
    const expiry = Date.now() + ttlSeconds * 1000;
    memoryCache.set(key, { value, expiry });
  },

  delete: async (key) => {
    if (isRedisEnabled()) {
      // await client.del(key);
    }
    memoryCache.delete(key);
  },

  clear: () => {
    memoryCache.clear();
  },

  /**
   * Return all currently-stored keys (expired entries are included).
   * Useful for targeted prefix-based invalidation.
   */
  keys: () => Array.from(memoryCache.keys()),

  /**
   * Delete all keys that start with the given prefix.
   * O(n) over matching keys only — faster than iterating all keys at call sites.
   */
  deleteByPrefix: (prefix) => {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
  },
};

module.exports = cache;
