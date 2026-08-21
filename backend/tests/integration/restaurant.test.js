'use strict'
/**
 * tests/integration/restaurant.test.js
 * Prompt 11 — Restaurant profile CRUD + dine page listing.
 *
 * Sections:
 *   1. POST /restaurant/profile  — vendor creates a restaurant profile
 *   2. GET  /restaurant/profile  — vendor fetches own profile
 *   3. PATCH /restaurant/profile — vendor updates profile
 *   4. GET  /dine                — public dine-page listing (zone-scoped)
 *   5. GET  /dine/restaurant/:id — public restaurant menu page
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                       = require('../setup/app')
const { createUser, createVendorUser }   = require('../factories')
const { signToken, authHeader }          = require('../helpers/auth')

const Vendor            = require('../../models/Vendor.model')
const RestaurantProfile = require('../../models/RestaurantProfile.model')
const LogisticZone      = require('../../models/LogisticZone.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let restaurantVendorUser, restaurantVendorDoc, regularVendorUser, cityZone

beforeEach(async () => {
  // A city-level zone is required by createProfile
  cityZone = await LogisticZone.create({
    name:   'Douala City',
    type:   'city',
    code:   `DLA-TEST-${Date.now()}`,
    level:  1,
  })

  // Restaurant vendor
  restaurantVendorUser = await createVendorUser({ verification_status: 'verified' })
  restaurantVendorDoc  = await Vendor.create({
    user_id:       restaurantVendorUser._id,
    store_name:    faker.company.name().slice(0, 100),
    description:   faker.lorem.sentence(),
    phone:         faker.phone.number(),
    vendor_type:   'restaurant',   // key — only restaurant vendors can create profiles
    verified:      true,
    is_onboarded:  true,
    rating:        0,
    total_sales:   0,
    total_revenue: 0,
  })

  // Regular (retail) vendor for negative tests
  regularVendorUser = await createVendorUser({ verification_status: 'verified' })
  await Vendor.create({
    user_id:       regularVendorUser._id,
    store_name:    faker.company.name().slice(0, 100),
    description:   faker.lorem.sentence(),
    phone:         faker.phone.number(),
    vendor_type:   'retail',
    verified:      true,
    rating:        0,
    total_sales:   0,
    total_revenue: 0,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper — seed a RestaurantProfile directly in DB
// ─────────────────────────────────────────────────────────────────────────────
const seedProfile = (overrides = {}) =>
  RestaurantProfile.create({
    vendor_id:         restaurantVendorDoc._id,
    city_zone_id:      cityZone._id,
    accepts_scheduled: false,
    is_accepting_orders: true,
    prep_time_minutes: 20,
    timezone:          'Africa/Douala',
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /restaurant/profile — create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /restaurant/profile — create restaurant profile', () => {
  it('creates a profile for a restaurant vendor and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ city_zone_id: cityZone._id })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profile.vendor_id.toString()).toBe(restaurantVendorDoc._id.toString())
  })

  it('returns 403 for a retail vendor (non-restaurant)', async () => {
    const res = await request(app)
      .post('/api/v1/restaurant/profile')
      .set(authHeader(signToken(regularVendorUser)))
      .send({ city_zone_id: cityZone._id })

    expect(res.status).toBe(403)
  })

  it('returns 400 when city_zone_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 409 when a profile already exists', async () => {
    await seedProfile()

    const res = await request(app)
      .post('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ city_zone_id: cityZone._id })

    expect(res.status).toBe(409)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/restaurant/profile')
      .send({ city_zone_id: cityZone._id })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /restaurant/profile — fetch own profile
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /restaurant/profile — fetch own restaurant profile', () => {
  it('returns the profile for the authenticated restaurant vendor', async () => {
    await seedProfile()

    const res = await request(app)
      .get('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profile.vendor_id.toString()).toBe(restaurantVendorDoc._id.toString())
  })

  it('returns 403 for a retail vendor', async () => {
    const res = await request(app)
      .get('/api/v1/restaurant/profile')
      .set(authHeader(signToken(regularVendorUser)))

    expect(res.status).toBe(403)
  })

  it('returns 404 when the profile does not exist yet', async () => {
    const res = await request(app)
      .get('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /restaurant/profile — update
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /restaurant/profile — update restaurant profile', () => {
  it('updates prep_time_minutes and returns the updated profile', async () => {
    await seedProfile()

    const res = await request(app)
      .patch('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ prep_time_minutes: 35 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.profile.prep_time_minutes).toBe(35)
  })

  it('returns 404 when no profile exists to update', async () => {
    const res = await request(app)
      .patch('/api/v1/restaurant/profile')
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ prep_time_minutes: 25 })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /dine — public dine page
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /dine — public dine-page listing', () => {
  it('returns 400 when zone_id is missing', async () => {
    const res = await request(app).get('/api/v1/dine')
    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent zone_id', async () => {
    const fakeZoneId = new mongoose.Types.ObjectId()
    const res = await request(app).get(`/api/v1/dine?zone_id=${fakeZoneId}`)
    expect(res.status).toBe(404)
  })

  it('returns 200 with restaurants and meals for a valid zone', async () => {
    await seedProfile({ is_accepting_orders: true })

    const res = await request(app).get(`/api/v1/dine?zone_id=${cityZone._id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  it('does not require authentication', async () => {
    const res = await request(app).get(`/api/v1/dine?zone_id=${cityZone._id}`)
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /dine/restaurant/:vendor_id — restaurant menu page
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /dine/restaurant/:vendor_id — public restaurant menu', () => {
  it('returns 200 with the restaurant menu for a valid vendor_id', async () => {
    await seedProfile()

    const res = await request(app)
      .get(`/api/v1/dine/restaurant/${restaurantVendorDoc._id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  it('returns 200 with a null profile when no profile exists (graceful fallback)', async () => {
    // The controller intentionally uses safe defaults so the UI never breaks during onboarding.
    const res = await request(app)
      .get(`/api/v1/dine/restaurant/${restaurantVendorDoc._id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Profile not configured yet — safe defaults: empty cuisine_types & no service zones
    expect(res.body.data.profile.cuisine_types).toHaveLength(0)
    expect(res.body.data.profile.service_zones).toHaveLength(0)
  })
})
