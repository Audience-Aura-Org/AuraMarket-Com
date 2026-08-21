'use strict'
/**
 * tests/integration/harness.test.js
 * Integration-project smoke test.
 *
 * Proves the full harness stack works:
 *   ✓ MongoMemoryReplSet is reachable and accepts writes
 *   ✓ Mongoose sessions / multi-document transactions work (replica set confirmed)
 *   ✓ User factory creates + retrieves a document
 *   ✓ Wallet money helper reads balance correctly
 *   ✓ The test app serves GET /api/health → 200
 */

const mongoose = require('mongoose')
const request  = require('supertest')

const { buildApp }   = require('../setup/app')
const { createUser, createUserWithBalance } = require('../factories')
const { getBalance, assertBalance } = require('../helpers/money')
const { signToken, authHeader }      = require('../helpers/auth')

// ── MongoDB connectivity ──────────────────────────────────────────────────────

describe('MongoDB (MongoMemoryReplSet)', () => {
  it('is connected and ready', () => {
    expect(mongoose.connection.readyState).toBe(1) // 1 = connected
  })

  it('accepts document writes and reads them back', async () => {
    const user = await createUser({ name: 'Harness Test', email: 'harness@test.example' })
    expect(user._id).toBeDefined()
    expect(user.name).toBe('Harness Test')

    const found = await require('../../models/User.model').findById(user._id).lean()
    expect(found?.email).toBe('harness@test.example')
  })

  it('supports multi-document transactions (replica set confirmed)', async () => {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        // Just prove session.withTransaction doesn't throw
        const User = require('../../models/User.model')
        await User.create([{ name: 'Tx User', email: `tx-${Date.now()}@test.example`, role: 'customer' }], { session })
      })
    } finally {
      await session.endSession()
    }
    // If we reach here without an error, transactions are working
    expect(true).toBe(true)
  })
})

// ── Factory + money helper ────────────────────────────────────────────────────

describe('User factory + money helper', () => {
  it('createUserWithBalance sets wallet_balance correctly', async () => {
    const user = await createUserWithBalance(10_000)
    await assertBalance(user._id, 10_000)
  })

  it('getBalance returns the current balance', async () => {
    const user = await createUser({ wallet_balance: 3_500 })
    const bal  = await getBalance(user._id)
    expect(bal).toBe(3_500)
  })
})

// ── HTTP health check ─────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 OK from the test app', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── JWT / auth helper ─────────────────────────────────────────────────────────

describe('auth helper → protected route', () => {
  it('a valid JWT is accepted by a protected endpoint', async () => {
    const app  = buildApp()
    const user = await createUser()
    const res  = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(signToken(user)))
    // 200 = auth passed and profile returned
    expect(res.status).not.toBe(401)
  })

  it('requests without a token are rejected with 401', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })
})
