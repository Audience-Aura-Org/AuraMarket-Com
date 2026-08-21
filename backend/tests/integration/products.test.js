'use strict'
/**
 * tests/integration/products.test.js
 * Prompt 7 — Product flows: public list, single detail, vendor create + guards.
 *
 * Sections:
 *   1. GET  /products          — public list, pagination, meal exclusion
 *   2. GET  /products/:id      — public detail + vendor-owns-non-active
 *   3. POST /products          — vendor create + pricing guards + subscription limit
 *
 * NOTE — product fixture creation:
 *   We insert fixtures via `Product.collection.insertOne()` (raw MongoDB — bypasses
 *   all Mongoose hooks) to keep the fixture code simple and hook-independent.
 *   The pre-save hook now uses the explicit `is_meal` boolean field (fixed from the
 *   original Mongoose-9.x-incompatible `!this.meal` check), so `Product.create()`
 *   works correctly for non-meal products as well.
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                              = require('../setup/app')
const { createUser, createVendorUser,
        createCategory }                       = require('../factories')
const { signToken, authHeader }                 = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const Product          = require('../../models/Product.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const SubscriptionPlan = require('../../models/SubscriptionPlan.model')
const UserSubscription = require('../../models/UserSubscription.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, vendorDoc, category, customer

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    // Subscription NOT required so create-product tests don't need a UserSubscription
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])

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

  category = await createCategory({ name: 'Electronics', applies_to: 'retail' })

  customer = await createUser()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a product via raw MongoDB collection to bypass the Mongoose pre-save
 * meal-validation hook (Mongoose 9 always initialises the meal nested schema
 * to a truthy {} with defaults, so `!this.meal` is never true unless we pass
 * meal: null explicitly in Product.create — which collection.insertOne allows).
 */
const makeProduct = async (overrides = {}) => {
  const productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:         productId,
    vendor_id:   vendorDoc._id,
    name:        faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price:       5_000,
    stock:       10,
    status:      'active',
    category:    category.name,
    category_id: category._id,
    images:      [],
    meal:        null,   // null → !this.meal → pre-save hook exits early
    createdAt:   new Date(),
    updatedAt:   new Date(),
    ...overrides,
  })
  return { _id: productId }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /products — public list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /products — public list', () => {
  it('returns active non-meal products without authentication', async () => {
    await makeProduct({ name: 'Widget Alpha' })
    await makeProduct({ name: 'Widget Beta' })

    const res = await request(app).get('/api/v1/products')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.products)).toBe(true)
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(2)
  })

  it('excludes draft (non-active) products from public results', async () => {
    await makeProduct({ name: 'Visible Product', status: 'active' })
    await makeProduct({ name: 'Hidden Draft',   status: 'draft' })

    const res = await request(app).get('/api/v1/products')

    expect(res.status).toBe(200)
    const names = res.body.data.products.map(p => p.name)
    expect(names).toContain('Visible Product')
    expect(names).not.toContain('Hidden Draft')
  })

  it('excludes meal products from the retail listing', async () => {
    await makeProduct({ name: 'Laptop' })
    // Insert meal product via raw collection.insertOne — also bypasses pre-save hook.
    const restaurantCat = await createCategory({ name: 'RestaurantCat', applies_to: 'restaurant' })
    await Product.collection.insertOne({
      _id:         new mongoose.Types.ObjectId(),
      vendor_id:   vendorDoc._id,
      name:        'Jollof Rice',
      description: 'A delicious meal.',
      price:       2_000,
      stock:       10,
      category:    restaurantCat.name,
      category_id: restaurantCat._id,
      images:      [],
      status:      'active',
      // truthy meal object → excluded by GET /products filter { meal: null }
      meal:        { booking_options: [{ type: 'delivery' }] },
      createdAt:   new Date(),
      updatedAt:   new Date(),
    })

    const res = await request(app).get('/api/v1/products')

    expect(res.status).toBe(200)
    const names = res.body.data.products.map(p => p.name)
    expect(names).toContain('Laptop')
    expect(names).not.toContain('Jollof Rice')
  })

  it('respects limit param for pagination', async () => {
    for (let i = 0; i < 5; i++) await makeProduct()

    const res = await request(app).get('/api/v1/products?limit=2')

    expect(res.status).toBe(200)
    expect(res.body.data.products.length).toBeLessThanOrEqual(2)
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /products/:id — single product detail
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /products/:id — product detail', () => {
  it('returns an active product without authentication', async () => {
    const product = await makeProduct()

    const res = await request(app).get(`/api/v1/products/${product._id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.product._id).toBe(product._id.toString())
  })

  it('returns 404 for a non-existent product ID', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${new mongoose.Types.ObjectId()}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when a non-active product is fetched without ownership', async () => {
    const product = await makeProduct({ status: 'pending' })

    const res = await request(app)
      .get(`/api/v1/products/${product._id}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(404)
  })

  it('allows the owning vendor to view their own pending product', async () => {
    const product = await makeProduct({ status: 'pending' })

    const res = await request(app)
      .get(`/api/v1/products/${product._id}`)
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.data.product._id).toBe(product._id.toString())
    expect(res.body.data.product.status).toBe('pending')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /products — vendor create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /products — vendor create', () => {
  const validPayload = () => ({
    name:        'Test Gadget',
    description: 'A very useful test gadget for integration testing.',
    price:       5_000,
    stock:       10,
    category:    'Electronics',
    is_meal:     'false', // mirrors what the frontend FormData sends
  })

  it('creates a product and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(authHeader(signToken(vendorUser)))
      .send(validPayload())

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.name).toBe('Test Gadget')
    expect(res.body.data.product.vendor_id).toBe(vendorDoc._id.toString())
  })

  it('rejects sale_price >= price with 400', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(authHeader(signToken(vendorUser)))
      .send({ ...validPayload(), sale_price: 5_000 }) // equal to price — invalid

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/sale price/i)
  })

  it('blocks a customer from creating a product (403)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(authHeader(signToken(customer)))
      .send(validPayload())

    expect(res.status).toBe(403)
  })

  it('enforces max_products plan limit and returns 403', async () => {
    // Enable subscription requirement for vendors
    await PlatformSettings.findOneAndUpdate({}, {
      $set: { 'subscription_required_roles.vendor': true },
    })

    // Create a plan that allows only 1 product
    const plan = await SubscriptionPlan.create({
      name:             'Starter Plan',
      slug:             'starter-plan-' + Date.now(),
      price:            0,
      roles:            ['vendor'],
      is_active:        true,
      contact_required: false,
      features:         [{ key: 'max_products', value: 1 }],
    })

    // Give the vendor an active subscription on this plan
    await UserSubscription.create({
      user_id:    vendorUser._id,
      plan_id:    plan._id,
      role:       'vendor',
      status:     'active',
      started_at: new Date(),
      history:    [],
    })

    // Create 1 product to hit the limit (via API, so subscription is checked)
    await request(app)
      .post('/api/v1/products')
      .set(authHeader(signToken(vendorUser)))
      .send(validPayload())

    // Second product should be blocked
    const res = await request(app)
      .post('/api/v1/products')
      .set(authHeader(signToken(vendorUser)))
      .send({ ...validPayload(), name: 'Test Gadget 2' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('PRODUCT_LIMIT_REACHED')
  })
})
