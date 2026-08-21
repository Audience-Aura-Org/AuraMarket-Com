'use strict'
/**
 * tests/integration/coupon.test.js
 * Prompt 9 — Coupon flows: validate and create.
 *
 * Sections:
 *   1. POST /coupons/validate — validate a coupon code
 *   2. POST /coupons         — create a coupon (admin / vendor only)
 */

const request   = require('supertest')

const { buildApp }                               = require('../setup/app')
const { createUser, createAdmin, createVendorUser,
        createCoupon }                           = require('../factories')
const { signToken, authHeader }                  = require('../helpers/auth')

const Vendor = require('../../models/Vendor.model')
const { faker } = require('@faker-js/faker')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let customer, admin, vendorUser, vendorDoc

beforeEach(async () => {
  customer   = await createUser()
  admin      = await createAdmin()
  vendorUser = await createVendorUser({ verification_status: 'verified' })
  vendorDoc  = await Vendor.create({
    user_id:       vendorUser._id,
    store_name:    faker.company.name().slice(0, 100),
    description:   faker.lorem.sentence(),
    phone:         faker.phone.number(),
    verified:      true,
    rating:        0,
    total_sales:   0,
    total_revenue: 0,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /coupons/validate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /coupons/validate — validate a coupon code', () => {
  it('returns discount details for a valid percentage coupon', async () => {
    const coupon = await createCoupon({
      discount_type:  'percentage',
      discount_value: 20,
      min_order_amount: 0,
    })

    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: coupon.code, orderAmount: 10_000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.discount_amount).toBe(2_000) // 20% of 10_000
    expect(res.body.data.code).toBe(coupon.code)
  })

  it('returns the correct discount for a fixed-amount coupon', async () => {
    const coupon = await createCoupon({
      discount_type:  'fixed',
      discount_value: 1_500,
      min_order_amount: 0,
    })

    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: coupon.code, orderAmount: 5_000 })

    expect(res.status).toBe(200)
    expect(res.body.data.discount_amount).toBe(1_500)
  })

  it('caps the percentage discount at max_discount_amount', async () => {
    const coupon = await createCoupon({
      discount_type:       'percentage',
      discount_value:      50,
      max_discount_amount: 2_000,
      min_order_amount:    0,
    })

    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: coupon.code, orderAmount: 20_000 })

    expect(res.status).toBe(200)
    expect(res.body.data.discount_amount).toBe(2_000) // capped
  })

  it('returns 404 for an unknown or inactive coupon code', async () => {
    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: 'DOESNOTEXIST', orderAmount: 5_000 })

    expect(res.status).toBe(404)
  })

  it('returns 400 for an expired coupon', async () => {
    const coupon = await createCoupon({
      expiry_date: new Date(Date.now() - 1000), // already expired
    })

    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: coupon.code, orderAmount: 5_000 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when order amount is below min_order_amount', async () => {
    const coupon = await createCoupon({ min_order_amount: 10_000 })

    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set(authHeader(signToken(customer)))
      .send({ code: coupon.code, orderAmount: 500 })

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /coupons — create coupon
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /coupons — create a coupon', () => {
  it('admin can create a platform-wide coupon and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/coupons')
      .set(authHeader(signToken(admin)))
      .send({
        code:           'ADMINSAVE20',
        discount_type:  'percentage',
        discount_value: 20,
        expiry_date:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.coupon.code).toBe('ADMINSAVE20')
  })

  it('vendor can create a coupon scoped to their store and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/coupons')
      .set(authHeader(signToken(vendorUser)))
      .send({
        code:           'VENDORDEAL10',
        discount_type:  'fixed',
        discount_value: 500,
        expiry_date:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

    expect(res.status).toBe(201)
    expect(res.body.data.coupon.vendor_id).toBeDefined()
  })

  it('returns 403 when a customer tries to create a coupon', async () => {
    const res = await request(app)
      .post('/api/v1/coupons')
      .set(authHeader(signToken(customer)))
      .send({
        code:           'HACKCODE',
        discount_type:  'percentage',
        discount_value: 99,
        expiry_date:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

    expect(res.status).toBe(403)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/coupons')
      .send({ code: 'NOPE', discount_type: 'fixed', discount_value: 100, expiry_date: new Date() })

    expect(res.status).toBe(401)
  })
})
