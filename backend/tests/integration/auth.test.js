'use strict'
/**
 * tests/integration/auth.test.js
 * Prompt 3 — Auth guards, token invalidation, verification lock, mass-assignment.
 *
 * FIX PROTOCOL:
 *   [T] = test was wrong
 *   [S] = spec ambiguous
 *   [C] = code wrong (fix code, then write regression)
 *
 * Sections:
 *   1. Token presence / validity
 *   2. Token version (session invalidation after logout / password change)
 *   3. Deactivated account
 *   4. Verification lock (KYC not complete)
 *   5. Mass-assignment protection on PATCH /auth/update-profile
 */

const request = require('supertest')
const jwt     = require('jsonwebtoken')
const User    = require('../../models/User.model')

const { buildApp }   = require('../setup/app')
const { createUser } = require('../factories')
const { authHeader, signToken, expiredToken } = require('../helpers/auth')

// ── 1. Token presence / validity ─────────────────────────────────────────────

describe('Auth guard — token presence & validity', () => {
  let app

  beforeAll(() => { app = buildApp() })

  it('rejects requests with no token with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects a malformed token (not a valid JWT) with an error response', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.jwt')
    // middleware passes error to global error handler → 4xx or 5xx, never 200
    expect(res.status).not.toBe(200)
  })

  it('rejects an expired token', async () => {
    const user  = await createUser()
    const token = expiredToken(user)  // signed with expiresIn: '-1s'
    const res   = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).not.toBe(200)
  })

  it('rejects a token signed with a wrong secret', async () => {
    const user  = await createUser()
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, tokenVersion: 0 },
      'wrong-secret',
      { expiresIn: '1h' }
    )
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).not.toBe(200)
  })

  it('rejects a token whose user no longer exists in the database', async () => {
    const user = await createUser()
    // sign the token BEFORE deleting the user
    const token = signToken(user)
    await User.findByIdAndDelete(user._id)

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/no longer exists/i)
  })
})

// ── 2. Token version (session invalidation) ───────────────────────────────────

describe('Auth guard — token version / session invalidation', () => {
  let app

  beforeAll(() => { app = buildApp() })

  it('accepts a token whose tokenVersion matches the current db value', async () => {
    const user  = await createUser({ token_version: 0 })
    const token = signToken(user)      // embeds tokenVersion: 0
    const res   = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).not.toBe(401)
  })

  it('rejects a token whose tokenVersion is stale (user was logged out)', async () => {
    // Start with token_version 0, issue a token, then bump the DB version
    const user  = await createUser({ token_version: 0 })
    const token = signToken(user)      // embeds tokenVersion: 0

    // Simulate logout / password-change bumping the version
    await User.findByIdAndUpdate(user._id, { token_version: 1 })

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/session is no longer valid/i)
  })
})

// ── 3. Deactivated account ───────────────────────────────────────────────────

describe('Auth guard — deactivated account', () => {
  let app

  beforeAll(() => { app = buildApp() })

  it('rejects a valid token for a deactivated user with 403', async () => {
    const user  = await createUser({ is_active: false })
    const token = signToken(user)
    const res   = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/deactivated/i)
  })
})

// ── 4. Verification lock (KYC pending) ───────────────────────────────────────

describe('Auth guard — verification lock', () => {
  let app

  beforeAll(() => { app = buildApp() })

  // Statuses that trigger the write lock
  for (const status of ['pending', 'held', 'rejected']) {
    it(`blocks PATCH requests for verification_status="${status}" with 423`, async () => {
      const user  = await createUser({ verification_status: status })
      const token = signToken(user)
      const res   = await request(app)
        .patch('/api/v1/auth/update-profile')
        .set(authHeader(token))
        .send({ name: 'New Name' })
      expect(res.status).toBe(423)
      expect(res.body.code).toBe('VERIFICATION_REQUIRED')
    })
  }

  it('allows GET requests through even when verification is pending', async () => {
    const user  = await createUser({ verification_status: 'pending' })
    const token = signToken(user)
    const res   = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
    // GET is always allowed — must NOT be 423
    expect(res.status).not.toBe(423)
  })

  it('allows writes once verification_status is "verified"', async () => {
    const user  = await createUser({ verification_status: 'verified' })
    const token = signToken(user)
    const res   = await request(app)
      .patch('/api/v1/auth/update-profile')
      .set(authHeader(token))
      .send({ name: 'Updated Name' })
    expect(res.status).not.toBe(423)
  })
})

// ── 5. Mass-assignment protection ────────────────────────────────────────────

describe('Mass-assignment — PATCH /auth/update-profile', () => {
  let app

  beforeAll(() => { app = buildApp() })

  it('ignores role in the request body — role stays unchanged', async () => {
    const user  = await createUser({ role: 'customer', verification_status: 'verified' })
    const token = signToken(user)

    await request(app)
      .patch('/api/v1/auth/update-profile')
      .set(authHeader(token))
      .send({ role: 'admin' })

    const fresh = await User.findById(user._id).lean()
    expect(fresh.role).toBe('customer')   // must not have been promoted
  })

  it('ignores wallet_balance in the request body — balance stays unchanged', async () => {
    const user  = await createUser({ wallet_balance: 0, verification_status: 'verified' })
    const token = signToken(user)

    await request(app)
      .patch('/api/v1/auth/update-profile')
      .set(authHeader(token))
      .send({ wallet_balance: 9_999_999 })

    const fresh = await User.findById(user._id).lean()
    expect(fresh.wallet_balance).toBe(0)
  })

  it('ignores is_active in the request body — cannot self-reactivate', async () => {
    // Create an active user (so the token is accepted), then verify the field is silently ignored
    const user  = await createUser({ verification_status: 'verified', is_active: true })
    const token = signToken(user)

    await request(app)
      .patch('/api/v1/auth/update-profile')
      .set(authHeader(token))
      .send({ is_active: false })

    const fresh = await User.findById(user._id).lean()
    expect(fresh.is_active).toBe(true)   // field was silently ignored — still true
  })

  it('still applies legitimate allowed fields (name, phone)', async () => {
    const user  = await createUser({ verification_status: 'verified' })
    const token = signToken(user)

    const res = await request(app)
      .patch('/api/v1/auth/update-profile')
      .set(authHeader(token))
      .send({ name: 'Alice Updated', phone: '+237123456789' })

    expect(res.status).toBe(200)
    const fresh = await User.findById(user._id).lean()
    expect(fresh.name).toBe('Alice Updated')
    expect(fresh.phone).toBe('+237123456789')
  })
})
