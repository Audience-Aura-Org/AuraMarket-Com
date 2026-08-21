'use strict'
/**
 * tests/integration/legal.test.js
 * Prompt 12 — Legal document endpoints: fetch (public) and admin update.
 *
 * Sections:
 *   1. GET  /legal/:type — fetch the active version of a legal document
 *   2. POST /legal       — admin creates / replaces a legal document
 */

const request = require('supertest')

const { buildApp }              = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Legal = require('../../models/Legal.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Seed an active legal document directly. */
const seedDoc = (type = 'terms_of_service') =>
  Legal.create({
    type,
    version:    '1.0',
    content:    '# Terms\n\nThese are the terms.',
    is_active:  true,
  })

/** Valid admin POST payload. */
const docPayload = (type = 'privacy_policy') => ({
  type,
  version: '2.0',
  content: '# Privacy Policy\n\nWe respect your privacy.',
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /legal/:type — public read
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /legal/:type — fetch the active legal document', () => {
  it('returns 200 with the active document when it exists', async () => {
    await seedDoc('terms_of_service')

    const res = await request(app).get('/api/v1/legal/terms_of_service')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.doc.type).toBe('terms_of_service')
    expect(res.body.data.doc.is_active).toBe(true)
  })

  it('returns 404 when no active document exists for the type', async () => {
    const res = await request(app).get('/api/v1/legal/cookie_policy')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('does not require authentication', async () => {
    await seedDoc('vendor_agreement')
    const res = await request(app).get('/api/v1/legal/vendor_agreement')
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /legal — admin update
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /legal — admin creates a legal document', () => {
  it('creates a new legal document and returns 201', async () => {
    const admin = await createAdmin()

    const res = await request(app)
      .post('/api/v1/legal')
      .set(authHeader(signToken(admin)))
      .send(docPayload('privacy_policy'))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.doc.type).toBe('privacy_policy')
    expect(res.body.data.doc.version).toBe('2.0')
    expect(res.body.data.doc.is_active).toBe(true)
  })

  it('the newly created document is fetchable via GET', async () => {
    const admin = await createAdmin()
    await request(app)
      .post('/api/v1/legal')
      .set(authHeader(signToken(admin)))
      .send(docPayload('cookie_policy'))

    const res = await request(app).get('/api/v1/legal/cookie_policy')
    expect(res.status).toBe(200)
    expect(res.body.data.doc.version).toBe('2.0')
  })

  it('returns 403 when a regular user calls the admin endpoint', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/legal')
      .set(authHeader(signToken(user)))
      .send(docPayload('privacy_policy'))

    expect(res.status).toBe(403)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/legal')
      .send(docPayload('privacy_policy'))

    expect(res.status).toBe(401)
  })
})
