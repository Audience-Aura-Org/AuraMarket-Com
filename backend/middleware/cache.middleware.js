const crypto = require('crypto');
const { getRedis, redisFeatures } = require('../config/redis');

const DEFAULT_TTL_SECONDS = Number(process.env.API_CACHE_TTL_SECONDS || 60);
const REDIS_PREFIX = process.env.API_CACHE_REDIS_PREFIX || 'auradime:api-cache:';
const cacheStore = new Map();

const stableKey = (req) => {
  const raw = `${req.method}:${req.originalUrl}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
};

const cleanupExpired = () => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) cacheStore.delete(key);
  }
};

setInterval(cleanupExpired, 60 * 1000).unref?.();

const cacheResponse = ({ ttlSeconds = DEFAULT_TTL_SECONDS, privateRoute = false } = {}) => {
  const ttl = Math.max(0, Number(ttlSeconds) || 0);

  return async (req, res, next) => {
    if (
      ttl === 0 ||
      req.method !== 'GET' ||
      req.headers.authorization ||
      req.user ||
      req.query?.nocache === '1' ||
      privateRoute
    ) {
      res.set('Cache-Control', 'no-store');
      return next();
    }

    const key = stableKey(req);
    const redisKey = `${REDIS_PREFIX}${key}`;
    const cached = cacheStore.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      res.set(cached.headers);
      res.set('X-Auradime-Cache', 'HIT');
      return res.status(cached.status).send(cached.body);
    }

    const redis = redisFeatures.cache ? getRedis() : null;
    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(redisKey);
        if (raw) {
          const cachedRedis = JSON.parse(raw);
          res.set(cachedRedis.headers || {});
          res.set('X-Auradime-Cache', 'HIT-REDIS');
          return res.status(cachedRedis.status || 200).send(cachedRedis.body);
        }
      } catch (error) {
        console.warn(`[Cache] Redis read skipped: ${error.message}`);
      }
    }

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entry = {
          status: res.statusCode,
          headers: {
            'Content-Type': res.get('Content-Type') || 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
          },
          body,
          expiresAt: now + ttl * 1000,
        };
        cacheStore.set(key, entry);
        if (redis?.status === 'ready') {
          redis
            .set(redisKey, JSON.stringify(entry), 'EX', ttl)
            .catch((error) => console.warn(`[Cache] Redis write skipped: ${error.message}`));
        }
        res.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
      }
      res.set('X-Auradime-Cache', 'MISS');
      return originalSend(body);
    };

    return next();
  };
};

const clearApiCache = async () => {
  cacheStore.clear();
  const redis = getRedis();
  if (redis?.status !== 'ready') return;

  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${REDIS_PREFIX}*`, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length) await redis.del(keys);
  } while (cursor !== '0');
};

module.exports = {
  cacheResponse,
  clearApiCache,
};
