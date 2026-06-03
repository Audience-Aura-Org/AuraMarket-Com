const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = Number(process.env.API_CACHE_TTL_SECONDS || 60);
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

  return (req, res, next) => {
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
    const cached = cacheStore.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      res.set(cached.headers);
      res.set('X-Auradime-Cache', 'HIT');
      return res.status(cached.status).send(cached.body);
    }

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheStore.set(key, {
          status: res.statusCode,
          headers: {
            'Content-Type': res.get('Content-Type') || 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`,
          },
          body,
          expiresAt: now + ttl * 1000,
        });
        res.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
      }
      res.set('X-Auradime-Cache', 'MISS');
      return originalSend(body);
    };

    return next();
  };
};

const clearApiCache = () => cacheStore.clear();

module.exports = {
  cacheResponse,
  clearApiCache,
};
