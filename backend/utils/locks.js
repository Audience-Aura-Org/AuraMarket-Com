/**
 * utils/locks.js
 * Auradime — Distributed Redis lock using SET NX EX.
 *
 * Guarantees that at most one process/worker runs a given critical section
 * at a time across a PM2 cluster.
 *
 * Usage:
 *   const { ran, result } = await withLock('worker:escrow', 600, async () => {
 *     // only one worker executes this at a time
 *   });
 *   if (!ran) console.log('Lock not acquired — another worker is running');
 */

const { v4: uuidv4 } = require('crypto').webcrypto ? { v4: () => require('crypto').randomUUID() } : { v4: () => require('crypto').randomBytes(16).toString('hex') };
const { getRedis } = require('../config/redis');
const logger       = require('./logger');

/**
 * Acquire a Redis lock, run fn, release the lock.
 *
 * @param {string}   key        - Lock name (prefixed internally with 'lock:')
 * @param {number}   ttlSeconds - Maximum seconds the lock can be held (auto-expires on crash)
 * @param {Function} fn         - Async function to run if the lock is acquired
 * @returns {{ ran: boolean, result: * }} ran=false means lock not acquired (another process holds it)
 */
const withLock = async (key, ttlSeconds, fn) => {
  const redis = getRedis();
  if (!redis) {
    // No Redis — fall through; in-process `running` flags still prevent same-process overlaps
    logger.warn(`[locks] Redis unavailable; running ${key} without distributed lock`);
    const result = await fn();
    return { ran: true, result };
  }

  const lockKey = `lock:${key}`;
  const lockId  = typeof uuidv4 === 'function' ? uuidv4() : require('crypto').randomBytes(16).toString('hex');

  // SET key value NX EX ttl  — only succeeds if key does not exist
  const acquired = await redis.set(lockKey, lockId, 'NX', 'EX', ttlSeconds);
  if (!acquired) {
    return { ran: false, result: null };
  }

  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    // Release only if we still own the lock (Lua script for atomicity)
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(releaseScript, 1, lockKey, lockId).catch((err) => {
      logger.error(`[locks] Failed to release lock ${lockKey}: ${err.message}`);
    });
  }
};

module.exports = { withLock };
