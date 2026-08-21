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
