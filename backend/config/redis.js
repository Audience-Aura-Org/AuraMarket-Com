const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '';
const REDIS_TLS = String(process.env.REDIS_TLS || '').toLowerCase() === 'true';
const boolEnv = (name, defaultValue = true) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase());
};

const REDIS_CACHE_ENABLED = boolEnv('REDIS_CACHE_ENABLED', true);
const REDIS_RATE_LIMIT_ENABLED = boolEnv('REDIS_RATE_LIMIT_ENABLED', true);
const REDIS_SOCKET_ENABLED = boolEnv('REDIS_SOCKET_ENABLED', true);

let client = null;
let duplicateClient = null;
let status = REDIS_URL ? 'configured' : 'disabled';

const buildOptions = () => ({
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 250, 3000);
  },
  ...(REDIS_TLS ? { tls: {} } : {}),
});

const wireEvents = (redis, label) => {
  redis.on('connect', () => {
    status = 'connected';
    console.log(`✅ [Redis] ${label} connected.`);
  });

  redis.on('ready', () => {
    status = 'ready';
  });

  redis.on('error', (error) => {
    status = 'error';
    console.warn(`⚠️ [Redis] ${label} error: ${error.message}`);
  });

  redis.on('end', () => {
    status = 'disconnected';
    console.warn(`⚠️ [Redis] ${label} disconnected.`);
  });
};

const getRedis = () => {
  if (!REDIS_URL) return null;
  if (!client) {
    client = new Redis(REDIS_URL, buildOptions());
    wireEvents(client, 'client');
    client.connect().catch((error) => {
      status = 'error';
      console.warn(`⚠️ [Redis] client connection skipped: ${error.message}`);
    });
  }
  return client;
};

const getRedisDuplicate = () => {
  if (!REDIS_URL) return null;
  if (!duplicateClient) {
    duplicateClient = getRedis().duplicate();
    wireEvents(duplicateClient, 'subscriber');
    duplicateClient.connect().catch((error) => {
      console.warn(`⚠️ [Redis] subscriber connection skipped: ${error.message}`);
    });
  }
  return duplicateClient;
};

const getRedisStatus = () => ({
  enabled: Boolean(REDIS_URL),
  cache: Boolean(REDIS_URL && REDIS_CACHE_ENABLED),
  rateLimit: Boolean(REDIS_URL && REDIS_RATE_LIMIT_ENABLED),
  socket: Boolean(REDIS_URL && REDIS_SOCKET_ENABLED),
  status,
});

const closeRedis = async () => {
  const clients = [duplicateClient, client].filter(Boolean);
  await Promise.allSettled(clients.map((redis) => redis.quit()));
  client = null;
  duplicateClient = null;
  status = REDIS_URL ? 'configured' : 'disabled';
};

module.exports = {
  getRedis,
  getRedisDuplicate,
  getRedisStatus,
  redisFeatures: {
    cache: REDIS_CACHE_ENABLED,
    rateLimit: REDIS_RATE_LIMIT_ENABLED,
    socket: REDIS_SOCKET_ENABLED,
  },
  closeRedis,
};
