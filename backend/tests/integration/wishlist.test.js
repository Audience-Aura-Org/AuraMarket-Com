'use strict'
/**
 * tests/integration/wishlist.test.js
 * Prompt 9 — Wishlist flows: get, toggle (add & remove).
 *
 * Sections:
 *   1. GET  /wishlist                    — fetch own wishlist
 *   2. POST /wishlist/toggle/:productId  — add then remove a product
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }          = require('../setup/app')
const { createUser, createVendorUser } = require('../factories')
const { signToken, authHeader }        = require('../helpers/auth')

const Product = require('../../models/Product.model')
const Vendor  = require('../../models/Vendor.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let customer, productId

beforeEach(async () => {
  customer   = await createUser()
  const vendorUser = await createVendorUser({ verification_status: 'verified' })
  const vendorDoc  = await Vendor.create({
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
    _id:         productId,
    vendor_id:   vendorDoc._id,
    name:        faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price:       3_500,
    stock:       10,
    status:      'active',
    category:    'Fashion',
    images:      [],
    meal:        null,
    is_meal:     false,
    has_variants: false,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /wishlist — fetch wishlist
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /wishlist — fetch own wishlist', () => {
  it('returns an empty wishlist for a new user', async () => {
    const res = await request(app)
      .get('/api/v1/wishlist')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.wishlist.products).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/wishlist')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /wishlist/toggle/:productId — add and remove
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /wishlist/toggle/:productId — toggle wishlist', () => {
  it('adds a product to the wishlist and returns isWishlisted: true', async () => {
    const res = await request(app)
      .post(`/api/v1/wishlist/toggle/${productId}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.isWishlisted).toBe(true)
  })

  it('removes the product on second toggle and returns isWishlisted: false', async () => {
    // First toggle — add
    await request(app)
      .post(`/api/v1/wishlist/toggle/${productId}`)
      .set(authHeader(signToken(customer)))

    // Second toggle — remove
    const res = await request(app)
      .post(`/api/v1/wishlist/toggle/${productId}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.isWishlisted).toBe(false)
  })

  it('GET /wishlist reflects the added product', async () => {
    await request(app)
      .post(`/api/v1/wishlist/toggle/${productId}`)
      .set(authHeader(signToken(customer)))

    const res = await request(app)
      .get('/api/v1/wishlist')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.wishlist.products).toHaveLength(1)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post(`/api/v1/wishlist/toggle/${productId}`)
    expect(res.status).toBe(401)
  })
})
