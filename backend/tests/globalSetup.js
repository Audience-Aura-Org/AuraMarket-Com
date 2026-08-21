'use strict'
/**
 * tests/globalSetup.js
 * Auradime — Vitest global setup / teardown.
 *
 * Runs ONCE per `vitest` invocation, before any test file is loaded.
 * Starts a single-node MongoDB replica set (required for Mongoose sessions/
 * transactions) and injects all env vars that are needed by the app.
 * These vars are inherited by every fork worker via child_process.fork.
 */

const { MongoMemoryReplSet } = require('mongodb-memory-server')

/** @type {MongoMemoryReplSet | null} */
let replSet = null

/**
 * Global setup — called once before any test.
 */
async function setup() {
  // ── Required env vars (validateEnv() checks these) ──────────────────────
  // Set before any require() so modules that call validateEnv() at load time
  // don't exit the process.
  process.env.NODE_ENV                ||= 'test'
  process.env.PORT                    ||= '0'
  process.env.JWT_SECRET              ||= 'auradime-test-jwt-secret-32-chars!!'
  process.env.JWT_EXPIRES_IN          ||= '24h'

  // Generate valid VAPID keys using the web-push library itself, so that
  // notifier.js / webPush.setVapidDetails() receives correctly formatted keys.
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    try {
      const webPush = require('web-push')
      const keys = webPush.generateVAPIDKeys()
      process.env.VAPID_PUBLIC_KEY  = keys.publicKey
      process.env.VAPID_PRIVATE_KEY = keys.privateKey
    } catch (_e) {
      // web-push not available or generation failed — set dummy placeholder so
      // validateEnv() passes; notifier will log a warning and skip push setup.
      process.env.VAPID_PUBLIC_KEY  ||= 'test-vapid-public-key'
      process.env.VAPID_PRIVATE_KEY ||= 'test-vapid-private-key'
    }
  }

  process.env.PAYUNIT_WEBHOOK_SECRET  ||= 'test-payunit-secret'
  process.env.EVERSEND_WEBHOOK_SECRET ||= 'test-eversend-secret'

  // ── Disable Redis ────────────────────────────────────────────────────────
  // No Redis server in CI. Locks fall back to in-process; rate limiters use
  // memory store; Socket.io adapter uses in-process.
  process.env.REDIS_URL                = ''
  process.env.REDIS_CACHE_ENABLED      = 'false'
  process.env.REDIS_RATE_LIMIT_ENABLED = 'false'
  process.env.REDIS_SOCKET_ENABLED     = 'false'

  // ── Silence AWS S3 ───────────────────────────────────────────────────────
  process.env.AWS_S3_ENABLED          = 'false'
  process.env.AWS_S3_BUCKET           ||= 'test-bucket'
  process.env.AWS_REGION              ||= 'us-east-1'
  process.env.AWS_ACCESS_KEY_ID       ||= 'test-key-id'
  process.env.AWS_SECRET_ACCESS_KEY   ||= 'test-secret-key'

  // ── Silence email ────────────────────────────────────────────────────────
  process.env.EMAIL_HOST  ||= '127.0.0.1'
  process.env.EMAIL_PORT  ||= '1025'
  process.env.EMAIL_USER  ||= 'test@auradime.test'
  process.env.EMAIL_PASS  ||= 'test'

  // ── Start MongoMemoryReplSet ─────────────────────────────────────────────
  // A REPLICA SET (not standalone) is required for Mongoose sessions and
  // multi-document transactions. One node is sufficient for tests.
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
    },
  })

  const uri = replSet.getUri()
  process.env.MONGODB_URI = uri

  console.log(`\n[globalSetup] MongoDB replica set ready`)
  console.log(`[globalSetup]   URI: ${uri}\n`)
}

/**
 * Global teardown — called once after all tests complete.
 */
async function teardown() {
  if (replSet) {
    await replSet.stop()
    console.log('\n[globalTeardown] MongoDB replica set stopped')
    replSet = null
  }
}

/**
 * Vitest 4.x requires a DEFAULT export that is an async function.
 * The returned function (or an exported `teardown`) is called after all tests.
 */
module.exports = async function globalSetup() {
  await setup()
  return teardown          // Vitest calls this after all tests complete
}
