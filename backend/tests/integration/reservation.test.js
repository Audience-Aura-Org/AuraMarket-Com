'use strict'
/**
 * tests/integration/reservation.test.js
 * Prompt 11 — Reservation CRUD: create, list, status update, cancel.
 *
 * Sections:
 *   1. POST /reservations            — customer creates a reservation
 *   2. GET  /reservations/my         — customer lists own reservations
 *   3. GET  /reservations/vendor     — vendor lists incoming reservations
 *   4. PATCH /reservations/:id/status — vendor/admin confirms / completes
 *   5. DELETE /reservations/:id      — buyer or vendor cancels
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                              = require('../setup/app')
const { createUser, createVendorUser, createAdmin } = require('../factories')
const { signToken, authHeader }                 = require('../helpers/auth')

const Vendor            = require('../../models/Vendor.model')
const RestaurantProfile = require('../../models/RestaurantProfile.model')
const Reservation       = require('../../models/Reservation.model')
const LogisticZone      = require('../../models/LogisticZone.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let customer, restaurantVendorUser, restaurantVendorDoc, admin, cityZone

beforeEach(async () => {
  customer             = await createUser()
  admin                = await createAdmin()
  restaurantVendorUser = await createVendorUser({ verification_status: 'verified' })

  cityZone = await LogisticZone.create({
    name:  'Yaoundé City',
    type:  'city',
    code:  `YDE-TEST-${Date.now()}`,
    level: 1,
  })

  restaurantVendorDoc = await Vendor.create({
    user_id:       restaurantVendorUser._id,
    store_name:    faker.company.name().slice(0, 100),
    description:   faker.lorem.sentence(),
    phone:         faker.phone.number(),
    vendor_type:   'restaurant',
    verified:      true,
    is_onboarded:  true,
    rating:        0,
    total_sales:   0,
    total_revenue: 0,
  })

  // Restaurant profile with reservations enabled
  await RestaurantProfile.create({
    vendor_id:         restaurantVendorDoc._id,
    city_zone_id:      cityZone._id,
    accepts_scheduled: true,
    is_accepting_orders: true,
    prep_time_minutes: 20,
    timezone:          'Africa/Douala',
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A valid reservation payload with a future time slot. */
const futureSlot = () => {
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000)  // 2 hours from now
  const end   = new Date(start.getTime() + 90 * 60 * 1000)  // 90 min duration
  return { slot_start: start.toISOString(), slot_end: end.toISOString() }
}

const reservationPayload = (overrides = {}) => ({
  vendor_id:     restaurantVendorDoc._id,
  party_size:    2,
  contact_phone: '+237651000001',
  notes:         'Window seat preferred.',
  ...futureSlot(),
  ...overrides,
})

/** Seed a reservation directly in DB. */
const seedReservation = (customerId = customer._id, overrides = {}) => {
  const { slot_start, slot_end } = futureSlot()
  return Reservation.create({
    vendor_id:     restaurantVendorDoc._id,
    customer_id:   customerId,
    slot_start,
    slot_end,
    party_size:    2,
    contact_phone: '+237651000001',
    status:        'requested',
    ...overrides,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /reservations — create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /reservations — customer creates a reservation', () => {
  it('creates a reservation and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(authHeader(signToken(customer)))
      .send(reservationPayload())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reservation.status).toBe('requested')
    expect(res.body.data.reservation.party_size).toBe(2)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(authHeader(signToken(customer)))
      .send({ vendor_id: restaurantVendorDoc._id })  // missing slot, party_size, phone

    expect(res.status).toBe(400)
  })

  it('returns 400 when slot_start is in the past', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const end  = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const res = await request(app)
      .post('/api/v1/reservations')
      .set(authHeader(signToken(customer)))
      .send(reservationPayload({ slot_start: past, slot_end: end }))

    expect(res.status).toBe(400)
  })

  it('returns 404 when the vendor is not a restaurant', async () => {
    const retailVendorUser = await createVendorUser({ verification_status: 'verified' })
    const retailVendorDoc  = await Vendor.create({
      user_id:       retailVendorUser._id,
      store_name:    'Retail Shop',
      phone:         faker.phone.number(),
      vendor_type:   'retail',
      verified:      true,
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    const res = await request(app)
      .post('/api/v1/reservations')
      .set(authHeader(signToken(customer)))
      .send(reservationPayload({ vendor_id: retailVendorDoc._id }))

    expect(res.status).toBe(404)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .send(reservationPayload())

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /reservations/my — customer's own reservations
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /reservations/my — list own reservations', () => {
  it('returns only the authenticated customer\'s reservations', async () => {
    const otherCustomer = await createUser()
    await seedReservation(customer._id)
    await seedReservation(otherCustomer._id)

    const res = await request(app)
      .get('/api/v1/reservations/my')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reservations).toHaveLength(1)
    expect(res.body.data.reservations[0].customer_id.toString()).toBe(customer._id.toString())
  })

  it('returns an empty list when the customer has no reservations', async () => {
    const res = await request(app)
      .get('/api/v1/reservations/my')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.reservations).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/reservations/my')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /reservations/vendor — vendor's incoming reservations
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /reservations/vendor — vendor lists incoming reservations', () => {
  it('returns reservations for the authenticated restaurant vendor', async () => {
    await seedReservation()

    const res = await request(app)
      .get('/api/v1/reservations/vendor')
      .set(authHeader(signToken(restaurantVendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reservations.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 for a customer (non-vendor)', async () => {
    const res = await request(app)
      .get('/api/v1/reservations/vendor')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /reservations/:id/status — vendor confirms
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /reservations/:id/status — update reservation status', () => {
  it('vendor confirms a requested reservation', async () => {
    const reservation = await seedReservation()

    const res = await request(app)
      .patch(`/api/v1/reservations/${reservation._id}/status`)
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reservation.status).toBe('confirmed')
  })

  it('returns 403 when a customer tries to update status', async () => {
    const reservation = await seedReservation()

    const res = await request(app)
      .patch(`/api/v1/reservations/${reservation._id}/status`)
      .set(authHeader(signToken(customer)))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent reservation', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/reservations/${fakeId}/status`)
      .set(authHeader(signToken(restaurantVendorUser)))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /reservations/:id — cancel
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /reservations/:id — cancel a reservation', () => {
  it('customer cancels their own reservation and returns 200', async () => {
    const reservation = await seedReservation()

    const res = await request(app)
      .delete(`/api/v1/reservations/${reservation._id}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await Reservation.findById(reservation._id)
    expect(updated.status).toBe('cancelled')
  })

  it('returns 404 for a non-existent reservation', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/reservations/${fakeId}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(404)
  })

  it('returns 401 without authentication', async () => {
    const reservation = await seedReservation()

    const res = await request(app)
      .delete(`/api/v1/reservations/${reservation._id}`)

    expect(res.status).toBe(401)
  })
})
