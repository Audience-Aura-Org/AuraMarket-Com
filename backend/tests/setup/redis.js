'use strict'
/**
 * tests/setup/redis.js
 * Disable Redis for tests. Run as a setupFile so it executes before any
 * module in the test file is evaluated.
 *
 * Without Redis:
 *   - Rate limiters fall back to the in-memory store (memory-store)
 *   - Distributed locks (utils/locks.js) fall back to in-process execution
 *   - Cache (utils/cache.js) already uses in-memory Map — no change
 *   - Socket.io runs without the Redis adapter (no multi-instance fanout)
 */

process.env.REDIS_URL                = ''
process.env.REDIS_CACHE_ENABLED      = 'false'
process.env.REDIS_RATE_LIMIT_ENABLED = 'false'
process.env.REDIS_SOCKET_ENABLED     = 'false'
// Disable the in-memory cache for all integration/concurrency tests so that
// tests never see stale cached responses from a previous test in the same run.
process.env.DISABLE_CACHE            = 'true'
