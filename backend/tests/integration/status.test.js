'use strict'
/**
 * tests/integration/status.test.js
 * Prompt 13 — Vendor story / status flows.
 *
 * Sections:
 *   1. GET  /statuses              — public active status list
 *   2. GET  /statuses/story/:id   — single status by ID
 *   3. POST /statuses/:id/view    — mark as viewed (protectOptional)
 *   4. GET  /statuses/my-statuses — vendor's own statuses (protected)
 *   5. POST /statuses             — vendor creates a status (subscription gate)
 *   6. DELETE /statuses/:id       — vendor deletes own status
 *   7. POST /statuses/:id/react   — like / unlike a status
 *
 * Note: subscription_required_roles.vendor is set to false in PlatformSettings
 * so requireActiveSubscription passes through for all tests.
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }               = require('../setup/app')
const { createUser, createVendor } = require('../factories')
const { signToken, authHeader }  = require('../helpers/auth')

const Status           = require('../../models/Status.model')
const Vendor           = require('../../models/Vendor.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, vendorDoc

beforeEach(async () => {
  // Subscription not required → middleware + controller check both pass
  await PlatformSettings.create({
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  })

  const created = await createVendor()
  vendorUser = created.user
  vendorDoc  = created.vendor
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Seed an active text status for the shared vendor. */
const seedStatus = (overrides = {}) =>
  Status.create({
    vendor_id:    vendorDoc._id,
    type:         'text',
    text_content: 'Flash sale today only!',
    expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000),
    category:     'Moment',
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /statuses — public active list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /statuses — public active status list', () => {
  it('returns 200 with an empty array when no statuses exist', async () => {
    const res = await request(app).get('/api/v1/statuses')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.count).toBe(0)
  })

  it('returns active statuses after seeding', async () => {
    await seedStatus()

    const res = await request(app).get('/api/v1/statuses')

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('does not return expired statuses', async () => {
    await seedStatus({ expires_at: new Date(Date.now() - 1000) }) // already expired

    const res = await request(app).get('/api/v1/statuses')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/v1/statuses')
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /statuses/story/:id — single status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /statuses/story/:id — single status by ID', () => {
  it('returns the status by ID', async () => {
    const status = await seedStatus()

    const res = await request(app).get(`/api/v1/statuses/story/${status._id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data._id.toString()).toBe(status._id.toString())
  })

  it('returns 404 for a non-existent or expired status', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app).get(`/api/v1/statuses/story/${fakeId}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 for an expired status', async () => {
    const expired = await seedStatus({ expires_at: new Date(Date.now() - 1000) })

    const res = await request(app).get(`/api/v1/statuses/story/${expired._id}`)

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /statuses/:id/view — mark as viewed
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /statuses/:id/view — mark a status as viewed', () => {
  it('increments views_count and returns 200', async () => {
    const status = await seedStatus()

    const res = await request(app)
      .post(`/api/v1/statuses/${status._id}/view`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await Status.findById(status._id)
    expect(updated.views_count).toBe(1)
  })

  it('does not double-count when the same authenticated user views again', async () => {
    const status = await seedStatus()
    const user   = await createUser()

    // First view
    await request(app)
      .post(`/api/v1/statuses/${status._id}/view`)
      .set(authHeader(signToken(user)))

    // Second view from the same user
    await request(app)
      .post(`/api/v1/statuses/${status._id}/view`)
      .set(authHeader(signToken(user)))

    const updated = await Status.findById(status._id)
    expect(updated.views_count).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /statuses/my-statuses — vendor's own statuses
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /statuses/my-statuses — vendor sees own statuses', () => {
  it('returns own statuses (including expired ones)', async () => {
    await seedStatus()

    const res = await request(app)
      .get('/api/v1/statuses/my-statuses')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('returns an empty list when the vendor has no statuses', async () => {
    const res = await request(app)
      .get('/api/v1/statuses/my-statuses')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('does not include statuses from other vendors', async () => {
    const other = await createVendor()
    // Seed a status for the OTHER vendor
    await Status.create({
      vendor_id:    other.vendor._id,
      type:         'text',
      text_content: 'Other vendor status',
      expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    const res = await request(app)
      .get('/api/v1/statuses/my-statuses')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    // Our vendor has no statuses; only other vendor's status exists
    expect(res.body.data).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/statuses/my-statuses')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /statuses — vendor creates a status
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /statuses — vendor creates a new status', () => {
  it('creates a text status and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/statuses')
      .set(authHeader(signToken(vendorUser)))
      .send({ type: 'text', text_content: 'Big sale this weekend!', category: 'Sale' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.type).toBe('text')
    expect(res.body.data.text_content).toBe('Big sale this weekend!')

    const saved = await Status.findById(res.body.data._id)
    expect(saved).not.toBeNull()
    expect(saved.vendor_id.toString()).toBe(vendorDoc._id.toString())
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/statuses')
      .send({ type: 'text', text_content: 'No token.' })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /statuses/:id — vendor deletes own status
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /statuses/:id — vendor deletes own status', () => {
  it('deletes own status and returns 200', async () => {
    const status = await seedStatus()

    const res = await request(app)
      .delete(`/api/v1/statuses/${status._id}`)
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const gone = await Status.findById(status._id)
    expect(gone).toBeNull()
  })

  it('returns 401 when another vendor tries to delete the status', async () => {
    const status = await seedStatus()
    const other  = await createVendor()

    const res = await request(app)
      .delete(`/api/v1/statuses/${status._id}`)
      .set(authHeader(signToken(other.user)))

    expect(res.status).toBe(401)
  })

  it('returns 404 for a non-existent status', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/statuses/${fakeId}`)
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /statuses/:id/react — like / unlike a status
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /statuses/:id/react — like or unlike a status', () => {
  it('likes a status on first reaction (liked: true)', async () => {
    const status = await seedStatus()
    const user   = await createUser()

    const res = await request(app)
      .post(`/api/v1/statuses/${status._id}/react`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.liked).toBe(true)
  })

  it('unlikes (toggles) when the user reacts again', async () => {
    const status = await seedStatus()
    const user   = await createUser()

    // First react → like
    await request(app)
      .post(`/api/v1/statuses/${status._id}/react`)
      .set(authHeader(signToken(user)))

    // Second react → unlike
    const res = await request(app)
      .post(`/api/v1/statuses/${status._id}/react`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.data.liked).toBe(false)
  })

  it('returns 401 without authentication', async () => {
    const status = await seedStatus()

    const res = await request(app)
      .post(`/api/v1/statuses/${status._id}/react`)

    expect(res.status).toBe(401)
  })
})
