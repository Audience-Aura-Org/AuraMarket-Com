'use strict'
/**
 * tests/integration/vendor.test.js
 * Prompt 8 — Vendor profile management + follow/unfollow + public store listing.
 *
 * Sections:
 *   1. GET  /vendor/me              — own profile (vendor-only)
 *   2. PATCH /vendor/profile        — update store_name / description
 *   3. PATCH /vendor/store          — update store settings
 *   4. Follow / Unfollow            — POST|DELETE /vendors/:id/follow + follow-status
 *   5. GET  /vendors                — public store listing
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                       = require('../setup/app')
const { createUser, createVendorUser }   = require('../factories')
const { signToken, authHeader }          = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, vendorDoc, customer

it('paginates and searches only the current vendor orders on the server', async () => {
  const { createOrder } = require('../factories')
  for (let i=0;i<21;i++) await createOrder({customerId:customer._id,vendorId:vendorDoc._id},{order_status:'processing'})
  await createOrder({customerId:customer._id,vendorId:new mongoose.Types.ObjectId()},{order_status:'processing'})
  const headers=authHeader(signToken(vendorUser))
  const first=await request(app).get('/api/v1/vendor/orders?limit=20&status=processing').set(headers)
  const second=await request(app).get('/api/v1/vendor/orders?limit=20&status=processing&page=2').set(headers)
  expect(first.status).toBe(200);expect(first.body.total).toBe(21)
  expect(first.body.data.orders).toHaveLength(20);expect(second.body.data.orders).toHaveLength(1)
  const id=second.body.data.orders[0]._id
  expect(first.body.data.orders.some(order=>order._id===id)).toBe(false)
  const search=await request(app).get('/api/v1/vendor/orders').query({search:id.slice(-8)}).set(headers)
  expect(search.status).toBe(200);expect(search.body.total).toBe(1)
})

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])

  vendorUser = await createVendorUser({ verification_status: 'verified' })
  vendorDoc  = await Vendor.create({
    user_id:             vendorUser._id,
    store_name:          faker.company.name().slice(0, 100),
    description:         faker.lorem.sentence(),
    phone:               faker.phone.number(),
    verified:            true,
    is_onboarded:        true,
    rating:              0,
    total_sales:         0,
    total_revenue:       0,
    follower_count:      0,
  })

  customer = await createUser()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /vendor/me — own vendor profile
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /vendor/me — own vendor profile', () => {
  it('returns the vendor profile to an authenticated vendor', async () => {
    const res = await request(app)
      .get('/api/v1/vendor/me')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.vendor._id.toString()).toBe(vendorDoc._id.toString())
    expect(res.body.data).toHaveProperty('escrow_balance')
    expect(res.body.data).toHaveProperty('effective_commission_rate')
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/vendor/me')
    expect(res.status).toBe(401)
  })

  it('returns 403 when a customer (non-vendor) calls the endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/vendor/me')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /vendor/profile — update vendor profile
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /vendor/profile — update vendor profile', () => {
  it('updates store_name and description and returns the updated vendor', async () => {
    const newName = 'Updated Store Name'
    const res = await request(app)
      .patch('/api/v1/vendor/profile')
      .set(authHeader(signToken(vendorUser)))
      .send({ store_name: newName, description: 'Updated description.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.vendor.store_name).toBe(newName)
  })

  it('returns 403 when a customer tries to update a vendor profile', async () => {
    const res = await request(app)
      .patch('/api/v1/vendor/profile')
      .set(authHeader(signToken(customer)))
      .send({ store_name: 'Hacked Name' })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /vendor/store — update store settings
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /vendor/store — update store settings', () => {
  it('updates delivery_time and minimum_order_amount', async () => {
    const res = await request(app)
      .patch('/api/v1/vendor/store')
      .set(authHeader(signToken(vendorUser)))
      .send({ delivery_time: '30-45 mins', minimum_order_amount: 2000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.store).toBeDefined()
  })

  it('returns 403 for a non-vendor user', async () => {
    const res = await request(app)
      .patch('/api/v1/vendor/store')
      .set(authHeader(signToken(customer)))
      .send({ delivery_time: '10 mins' })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Follow / Unfollow
// ─────────────────────────────────────────────────────────────────────────────

describe('Follow / Unfollow — POST|DELETE /vendors/:id/follow', () => {
  it('follows a vendor and returns 201 with updated follower_count', async () => {
    const res = await request(app)
      .post(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.follower_count).toBe('number')
    expect(res.body.follower_count).toBeGreaterThanOrEqual(1)
  })

  it('returns 400 when the user tries to follow the same vendor twice', async () => {
    // First follow
    await request(app)
      .post(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    // Second follow — should be rejected
    const res = await request(app)
      .post(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(400)
  })

  it('unfollows a vendor after following and returns 200', async () => {
    // Follow first
    await request(app)
      .post(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    // Then unfollow
    const res = await request(app)
      .delete(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 400 when trying to unfollow a vendor that is not being followed', async () => {
    const res = await request(app)
      .delete(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(400)
  })

  it('GET follow-status returns is_following: false before follow', async () => {
    const res = await request(app)
      .get(`/api/v1/vendors/${vendorDoc._id}/follow-status`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.is_following).toBe(false)
  })

  it('GET follow-status returns is_following: true after follow', async () => {
    await request(app)
      .post(`/api/v1/vendors/${vendorDoc._id}/follow`)
      .set(authHeader(signToken(customer)))

    const res = await request(app)
      .get(`/api/v1/vendors/${vendorDoc._id}/follow-status`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.is_following).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /vendors — public store listing
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /vendors — public store listing', () => {
  it('returns onboarded vendors without authentication', async () => {
    const res = await request(app).get('/api/v1/vendors')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.stores)).toBe(true)
  })
})

describe('public directory eligibility and pagination', () => {
  it('excludes hidden and inactive accounts before pagination and projects only public fields', async () => {
    const Store = require('../../models/Store.model')
    const records = []
    for (let i = 0; i < 23; i++) {
      const account = await createVendorUser({ is_active: i !== 22 })
      const vendor = await Vendor.create({ user_id: account._id, store_name: 'Directory ' + String(i).padStart(2, '0'), phone: '+237650000001', is_onboarded: true, verified: i < 10 })
      await Store.create({ vendor_id: vendor._id, is_active: i !== 21 })
      records.push(vendor)
    }
    const first = await request(app).get('/api/v1/vendors?limit=20&search=Directory&sort=store_name')
    expect(first.status).toBe(200)
    expect(first.body.pagination.total).toBe(21)
    expect(first.body.data.stores).toHaveLength(20)
    expect(first.body.data.stores[0].user_id.email).toBeUndefined()
    expect(first.body.data.stores[0].user_id.password).toBeUndefined()
    const second = await request(app).get('/api/v1/vendors?limit=20&search=Directory&sort=store_name&page=2')
    expect(second.body.data.stores).toHaveLength(1)
    expect(second.body.data.stores[0]._id).toBe(String(records[20]._id))
    const verified = await request(app).get('/api/v1/vendors?verified=true&search=Directory')
    expect(verified.body.pagination.total).toBe(10)
    expect(verified.body.data.stores.every(store => store.verified)).toBe(true)
  })
})

it('does not recreate a missing store on a public GET and hides disabled stores', async () => {
  const Store = require('../../models/Store.model')
  const missing = await request(app).get('/api/v1/vendors/stores/' + vendorDoc._id)
  expect(missing.status).toBe(404)
  expect(await Store.countDocuments({ vendor_id: vendorDoc._id })).toBe(0)
  await Store.create({ vendor_id: vendorDoc._id, is_active: false })
  const disabled = await request(app).get('/api/v1/vendors/stores/' + vendorDoc._id)
  expect(disabled.status).toBe(404)
})

it('never caches private vendor responses authenticated with a session cookie', async () => {
  vi.stubEnv('DISABLE_CACHE', 'false')
  const { clearApiCache } = require('../../middleware/cache.middleware')
  await clearApiCache()
  const signedIn = await request(app).get('/api/v1/vendors/me').set('Cookie', 'aura_token=' + signToken(vendorUser))
  expect(signedIn.status).toBe(200)
  expect(signedIn.headers['cache-control']).toBe('no-store')
  const guest = await request(app).get('/api/v1/vendors/me')
  expect(guest.status).toBe(401)
  expect(guest.body.data?.vendor).toBeUndefined()
  await clearApiCache()
  vi.unstubAllEnvs()
})
