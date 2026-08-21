'use strict'
/**
 * tests/integration/address.test.js
 * Prompt 9 — Address CRUD: list, add, update, delete.
 *
 * Sections:
 *   1. GET  /addresses       — list own addresses
 *   2. POST /addresses       — add a new address (first becomes default)
 *   3. PATCH /addresses/:id  — update an existing address
 *   4. DELETE /addresses/:id — remove an address
 */

const request = require('supertest')
const mongoose = require('mongoose')

const { buildApp }          = require('../setup/app')
const { createUser }        = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const User = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let user

beforeEach(async () => {
  user = await createUser()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
const sampleAddress = (overrides = {}) => ({
  label:  'Home',
  street: '123 Main St',
  city:   'Douala',
  region: 'Littoral',
  ...overrides,
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /addresses
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /addresses — list own addresses', () => {
  it('returns an empty address list for a new user', async () => {
    const res = await request(app)
      .get('/api/v1/addresses')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.addresses).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/addresses')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /addresses — add address
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /addresses — add a new address', () => {
  it('creates an address and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.addresses).toHaveLength(1)
  })

  it('first address is automatically set as the default', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ isDefault: false }))  // explicitly false, should still become default

    expect(res.status).toBe(201)
    expect(res.body.data.addresses[0].isDefault).toBe(true)
  })

  it('second address does not override the existing default', async () => {
    await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Home' }))

    const res = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Work', isDefault: false }))

    expect(res.status).toBe(201)
    const addresses = res.body.data.addresses
    const defaultCount = addresses.filter(a => a.isDefault).length
    expect(defaultCount).toBe(1)
    expect(addresses[0].isDefault).toBe(true)   // first remains default
  })

  it('setting isDefault:true on a new address unsets existing default', async () => {
    await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Home' }))

    const res = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Work', isDefault: true }))

    expect(res.status).toBe(201)
    const addresses = res.body.data.addresses
    const defaultAddr = addresses.find(a => a.isDefault)
    expect(defaultAddr.label).toBe('Work')
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .send(sampleAddress())
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /addresses/:id — update address
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /addresses/:id — update an address', () => {
  it('updates the city of an existing address', async () => {
    const addRes = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress())

    const addrId = addRes.body.data.addresses[0]._id

    const res = await request(app)
      .patch(`/api/v1/addresses/${addrId}`)
      .set(authHeader(signToken(user)))
      .send({ city: 'Yaoundé' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const updated = res.body.data.addresses.find(a => a._id === addrId)
    expect(updated.city).toBe('Yaoundé')
  })

  it('returns 404 for a non-existent address id', async () => {
    const fakeId = new mongoose.Types.ObjectId()
    const res = await request(app)
      .patch(`/api/v1/addresses/${fakeId}`)
      .set(authHeader(signToken(user)))
      .send({ city: 'Nowhere' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE /addresses/:id — remove address
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /addresses/:id — remove an address', () => {
  it('deletes an address and returns the remaining list', async () => {
    const addRes = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress())

    const addrId = addRes.body.data.addresses[0]._id

    const res = await request(app)
      .delete(`/api/v1/addresses/${addrId}`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.addresses).toHaveLength(0)
  })

  it('auto-assigns a new default when the default address is deleted', async () => {
    // Add two addresses — first is default
    await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Home' }))

    const addRes = await request(app)
      .post('/api/v1/addresses')
      .set(authHeader(signToken(user)))
      .send(sampleAddress({ label: 'Work' }))

    const firstId = addRes.body.data.addresses[0]._id  // original default

    const res = await request(app)
      .delete(`/api/v1/addresses/${firstId}`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    // Remaining address should now be default
    expect(res.body.data.addresses[0].isDefault).toBe(true)
  })
})
