'use strict'
/**
 * tests/integration/tracking.test.js
 * Prompt 13 — User activity tracking and product metric increments.
 *
 * Sections:
 *   1. POST /tracking — record an action (authenticated and anonymous)
 *   2. Metric increment — 'view' action increments product view_count
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }          = require('../setup/app')
const { createUser, createVendor } = require('../factories')
const { signToken, authHeader }    = require('../helpers/auth')

const Product      = require('../../models/Product.model')
const UserActivity = require('../../models/UserActivity.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helper — seed a product for metric tests
// ─────────────────────────────────────────────────────────────────────────────
const seedProduct = async (vendorId) => {
  const productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:           productId,
    vendor_id:     vendorId,
    name:          faker.commerce.productName(),
    description:   faker.commerce.productDescription(),
    price:         3_000,
    stock:         20,
    status:        'active',
    category:      'Electronics',
    images:        [],
    meal:          null,
    is_meal:       false,
    has_variants:  false,
    view_count:    0,
    wishlist_count: 0,
    purchase_count: 0,
    cart_additions: 0,
    createdAt:     new Date(),
    updatedAt:     new Date(),
  })
  return productId
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /tracking — record an action
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /tracking — record a user action', () => {
  it('records a category browse action for an authenticated user (200)', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'search', search_query: 'sneakers', category: 'Shoes' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.action_type).toBe('search')
  })

  it('records an action anonymously (no auth token)', async () => {
    const res = await request(app)
      .post('/api/v1/track')
      .send({ action_type: 'search', search_query: 'headphones' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('stores the activity record in the DB', async () => {
    const user = await createUser()

    await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'search', search_query: 'laptop' })

    const record = await UserActivity.findOne({ action_type: 'search', search_query: 'laptop' })
    expect(record).not.toBeNull()
    expect(record.user_id.toString()).toBe(user._id.toString())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Metric increments — product counters updated by tracking actions
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /tracking — product metric increments', () => {
  let vendorId, productId

  beforeEach(async () => {
    const { vendor } = await createVendor()
    vendorId  = vendor._id
    productId = await seedProduct(vendorId)
  })

  it('increments view_count on a "view" action', async () => {
    const user = await createUser()

    await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'view', product_id: productId })

    const updated = await Product.findById(productId)
    expect(updated.view_count).toBe(1)
  })

  it('increments wishlist_count on a "wishlist" action', async () => {
    const user = await createUser()

    await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'wishlist', product_id: productId })

    const updated = await Product.findById(productId)
    expect(updated.wishlist_count).toBe(1)
  })

  it('increments purchase_count on a "purchase" action', async () => {
    const user = await createUser()

    await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'purchase', product_id: productId })

    const updated = await Product.findById(productId)
    expect(updated.purchase_count).toBe(1)
  })

  it('does not change product metrics for a "search" action (no product_id)', async () => {
    const user = await createUser()

    // Get baseline
    const before = await Product.findById(productId)

    await request(app)
      .post('/api/v1/track')
      .set(authHeader(signToken(user)))
      .send({ action_type: 'search', search_query: 'shoes' })

    const after = await Product.findById(productId)
    expect(after.view_count).toBe(before.view_count)
    expect(after.wishlist_count).toBe(before.wishlist_count)
  })
})
