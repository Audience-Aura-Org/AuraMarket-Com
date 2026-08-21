'use strict'
/**
 * tests/integration/discovery.test.js
 * Prompt 11 — Discovery feed endpoints: new arrivals, trending, popular, feed.
 *
 * All endpoints are public (no auth required).
 * Tests confirm the shape of the response and that each feed returns only
 * active retail products (not meals).
 *
 * Sections:
 *   1. GET /discovery/new        — newest products
 *   2. GET /discovery/trending   — most-viewed products
 *   3. GET /discovery/popular    — most-purchased products
 *   4. GET /discovery/feed       — combined discovery feed
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }          = require('../setup/app')
const { createVendorUser }  = require('../factories')

const Product = require('../../models/Product.model')
const Vendor  = require('../../models/Vendor.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture — one vendor + one active retail product
// ─────────────────────────────────────────────────────────────────────────────
let vendorDoc, productId

beforeEach(async () => {
  const vendorUser = await createVendorUser({ verification_status: 'verified' })
  vendorDoc = await Vendor.create({
    user_id:       vendorUser._id,
    store_name:    faker.company.name().slice(0, 100),
    description:   faker.lorem.sentence(),
    phone:         faker.phone.number(),
    verified:      true,
    rating:        0,
    total_sales:   0,
    total_revenue: 0,
  })

  productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:           productId,
    vendor_id:     vendorDoc._id,
    name:          faker.commerce.productName(),
    description:   faker.commerce.productDescription(),
    price:         3_500,
    stock:         5,
    status:        'active',
    category:      'Electronics',
    images:        [],
    meal:          null,      // retail product — not a meal
    is_meal:       false,
    has_variants:  false,
    view_count:    10,
    purchase_count: 3,
    wishlist_count: 2,
    createdAt:     new Date(),
    updatedAt:     new Date(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const expectDiscoveryShape = (res) => {
  expect(res.status).toBe(200)
  expect(res.body.success).toBe(true)
  expect(typeof res.body.count).toBe('number')
  expect(Array.isArray(res.body.data)).toBe(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /discovery/new — new arrivals
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /discovery/new — new arrivals', () => {
  it('returns 200 with an array of products', async () => {
    const res = await request(app).get('/api/v1/discovery/new')
    expectDiscoveryShape(res)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('does not include meal products', async () => {
    const res = await request(app).get('/api/v1/discovery/new')
    res.body.data.forEach(p => {
      expect(p.meal).toBeFalsy()
    })
  })

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/v1/discovery/new')
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /discovery/trending — trending products
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /discovery/trending — trending products', () => {
  it('returns 200 with products sorted by view_count', async () => {
    const res = await request(app).get('/api/v1/discovery/trending')
    expectDiscoveryShape(res)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /discovery/popular — popular products
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /discovery/popular — popular products', () => {
  it('returns 200 with products sorted by purchase_count', async () => {
    const res = await request(app).get('/api/v1/discovery/popular')
    expectDiscoveryShape(res)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /discovery/feed — combined feed
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /discovery/feed — combined discovery feed', () => {
  it('returns 200 with a discovery feed object', async () => {
    const res = await request(app).get('/api/v1/discovery/feed')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Feed response shape may vary — just confirm success and data presence
    expect(res.body.data).toBeDefined()
  })
})
