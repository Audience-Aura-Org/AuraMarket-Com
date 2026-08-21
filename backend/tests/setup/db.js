'use strict'
/**
 * tests/setup/db.js
 * Mongoose connection lifecycle for integration and concurrency test files.
 *
 * Loaded via `setupFiles` so it runs inside each fork worker, before the
 * test file is evaluated. Because pool: 'forks' creates a fresh Node.js
 * process per test file, mongoose state does not bleed between files.
 *
 * Hooks:
 *   beforeAll  – connect once per file
 *   afterEach  – delete every document in every collection (clean slate)
 *   afterAll   – disconnect
 */

const mongoose = require('mongoose')

beforeAll(async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      '[db.js] MONGODB_URI is not set. ' +
      'Make sure globalSetup ran before this setupFile.'
    )
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      // Use the same settings as production except for pool size
      serverSelectionTimeoutMS: 10_000,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 1,
    })
  }
}, 30_000)

afterEach(async () => {
  // Wipe all collections between tests so each test starts from a clean slate.
  // This is faster than recreating the replica set and keeps indexes intact.
  const { collections } = mongoose.connection
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  )
})

afterAll(async () => {
  await mongoose.disconnect()
}, 15_000)
