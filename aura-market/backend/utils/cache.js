/**
 * utils/cache.js
 * A simple caching utility that supports in-memory (Map) or Redis (logic ready).
 */

const memoryCache = new Map();

// Helper to determine if we should use Redis (if configured in process.env)
const isRedisEnabled = () => !!process.env.REDIS_URL;

const cache = {
  get: async (key) => {
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
  }
};

module.exports = cache;
