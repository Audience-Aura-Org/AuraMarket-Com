'use strict'
/**
 * tests/integration/security.test.js
 * Prompt 14 — Two-Factor Authentication (2FA) setup flow.
 *
 * Sections:
 *   1. GET  /security/2fa/generate — generate TOTP secret + QR code
 *   2. POST /security/2fa/enable   — verify token and enable 2FA
 *   3. POST /security/2fa/disable  — disable 2FA with token verification
 */

const request = require('supertest')
const { generateSync } = require('otplib')

const { buildApp }          = require('../setup/app')
const { createUser }        = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const User = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /security/2fa/generate
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /security/2fa/generate — generate 2FA secret', () => {
  it('returns a secret and QR code for an authenticated user', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/security/2fa/generate')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.secret).toBe('string')
    expect(res.body.data.secret.length).toBeGreaterThan(10)
    expect(res.body.data.qrCode).toMatch(/^data:image\/png;base64,/)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/security/2fa/generate')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /security/2fa/enable
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /security/2fa/enable — enable 2FA with TOTP token', () => {
  it('enables 2FA when a valid TOTP token is provided', async () => {
    const user   = await createUser()

    // Generate and store a secret first
    const genRes = await request(app)
      .get('/api/v1/security/2fa/generate')
      .set(authHeader(signToken(user)))

    const secret = genRes.body.data.secret
    // Generate a valid TOTP token from the secret using the v13 functional API
    const token  = generateSync({ secret })

    const res = await request(app)
      .post('/api/v1/security/2fa/enable')
      .set(authHeader(signToken(user)))
      .send({ token })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await User.findById(user._id).select('+two_factor_secret')
    expect(updated.two_factor_enabled).toBe(true)
  })

  it('returns 400 when token is missing from the request body', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/security/2fa/enable')
      .set(authHeader(signToken(user)))
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 401 when an invalid token is provided', async () => {
    const user = await createUser()

    // Generate a secret so the user has one stored
    await request(app)
      .get('/api/v1/security/2fa/generate')
      .set(authHeader(signToken(user)))

    const res = await request(app)
      .post('/api/v1/security/2fa/enable')
      .set(authHeader(signToken(user)))
      .send({ token: '000000' })  // wrong token

    expect(res.status).toBe(401)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/security/2fa/enable')
      .send({ token: '123456' })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /security/2fa/disable
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /security/2fa/disable — disable 2FA', () => {
  it('disables 2FA when a valid token is provided after enabling', async () => {
    const user = await createUser()

    // Enable 2FA first
    const genRes = await request(app)
      .get('/api/v1/security/2fa/generate')
      .set(authHeader(signToken(user)))
    const secret = genRes.body.data.secret

    const enableToken = generateSync({ secret })
    await request(app)
      .post('/api/v1/security/2fa/enable')
      .set(authHeader(signToken(user)))
      .send({ token: enableToken })

    // Now disable
    const disableToken = generateSync({ secret })
    const res = await request(app)
      .post('/api/v1/security/2fa/disable')
      .set(authHeader(signToken(user)))
      .send({ token: disableToken })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await User.findById(user._id)
    expect(updated.two_factor_enabled).toBe(false)
  })

  it('returns 400 when token is missing', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/security/2fa/disable')
      .set(authHeader(signToken(user)))
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/security/2fa/disable')
      .send({ token: '123456' })

    expect(res.status).toBe(401)
  })
})
