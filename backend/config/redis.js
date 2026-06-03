const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '';
const REDIS_TLS = String(process.env.REDIS_TLS || '').toLowerCase() === 'true';

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
  closeRedis,
};
