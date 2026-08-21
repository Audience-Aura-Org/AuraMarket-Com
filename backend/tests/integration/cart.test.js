'use strict'
/**
 * tests/integration/cart.test.js
 * Prompt 9 — Cart flows: add, get, update quantity, remove item, clear.
 *
 * Sections:
 *   1. GET  /cart           — fetch current user's cart
 *   2. POST /cart           — add a product to the cart
 *   3. PATCH /cart/item     — update item quantity
 *   4. DELETE /cart/item    — remove a single item
 *   5. DELETE /cart/clear   — clear entire cart
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                       = require('../setup/app')
const { createUser, createVendorUser }   = require('../factories')
const { signToken, authHeader }          = require('../helpers/auth')

const Product = require('../../models/Product.model')
const Vendor  = require('../../models/Vendor.model')
const Cart    = require('../../models/Cart.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let customer, vendorUser, vendorDoc, productId

beforeEach(async () => {
  customer   = await createUser()
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

  productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:         productId,
    vendor_id:   vendorDoc._id,
    name:        faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price:       5_000,
    stock:       20,
    status:      'active',
    category:    'Electronics',
    images:      [],
    meal:        null,
    is_meal:     false,
    has_variants: false,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /cart — fetch cart
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /cart — fetch current user cart', () => {
  it('returns an empty cart when the user has no items', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/cart')
    expect(res.status).toBe(401)
  })

  it('returns the cart with items after adding a product', async () => {
    // Seed a cart directly in DB
    await Cart.create({
      user_id: customer._id,
      items: [{ product: productId, quantity: 2 }],
    })

    const res = await request(app)
      .get('/api/v1/cart')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.cart.items).toHaveLength(1)
    expect(res.body.data.cart.items[0].quantity).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /cart — add product
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /cart — add product to cart', () => {
  it('adds a product and returns 200 with updated cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 1 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items).toHaveLength(1)
    expect(res.body.data.cart.items[0].quantity).toBe(1)
  })

  it('returns 400 when product_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ quantity: 1 })

    expect(res.status).toBe(400)
  })

  it('returns 404 when product does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId()
    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: fakeId, quantity: 1 })

    expect(res.status).toBe(404)
  })

  it('returns 400 when a vendor tries to add their own product', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(vendorUser)))
      .send({ product_id: productId, quantity: 1 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when requested quantity exceeds stock', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 9999 })

    expect(res.status).toBe(400)
  })

  it('increments quantity when the same product is added twice', async () => {
    await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 1 })

    const res = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 2 })

    expect(res.status).toBe(200)
    expect(res.body.data.cart.items).toHaveLength(1)
    expect(res.body.data.cart.items[0].quantity).toBe(3)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/cart')
      .send({ product_id: productId, quantity: 1 })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /cart/item — update quantity
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /cart/item — update item quantity', () => {
  it('updates the quantity of an existing cart item', async () => {
    // Add item first via API so we have its subdoc _id
    const addRes = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 1 })

    const itemId = addRes.body.data.cart.items[0]._id

    const res = await request(app)
      .patch('/api/v1/cart/item')
      .set(authHeader(signToken(customer)))
      .send({ item_id: itemId, quantity_delta: 2 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items[0].quantity).toBe(3)
  })

  it('returns 400 when item_id is missing', async () => {
    const res = await request(app)
      .patch('/api/v1/cart/item')
      .set(authHeader(signToken(customer)))
      .send({ quantity_delta: 1 })

    expect(res.status).toBe(400)
  })

  it('returns 404 when the cart does not exist', async () => {
    const fakeItemId = new mongoose.Types.ObjectId()
    const res = await request(app)
      .patch('/api/v1/cart/item')
      .set(authHeader(signToken(customer)))
      .send({ item_id: fakeItemId, quantity_delta: 1 })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE /cart/item — remove single item
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /cart/item — remove a single cart item', () => {
  it('removes an item by its subdoc _id and returns updated cart', async () => {
    const addRes = await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 1 })

    const itemId = addRes.body.data.cart.items[0]._id

    const res = await request(app)
      .delete('/api/v1/cart/item')
      .set(authHeader(signToken(customer)))
      .send({ item_id: itemId })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items).toHaveLength(0)
  })

  it('returns 400 when item_id is missing', async () => {
    const res = await request(app)
      .delete('/api/v1/cart/item')
      .set(authHeader(signToken(customer)))
      .send({})

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /cart/clear — clear entire cart
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /cart/clear — clear entire cart', () => {
  it('empties all items from the cart and returns 200', async () => {
    // Add an item first
    await request(app)
      .post('/api/v1/cart')
      .set(authHeader(signToken(customer)))
      .send({ product_id: productId, quantity: 2 })

    const res = await request(app)
      .delete('/api/v1/cart/clear')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items).toHaveLength(0)
  })

  it('returns 200 even when the cart is already empty', async () => {
    const res = await request(app)
      .delete('/api/v1/cart/clear')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.cart.items).toHaveLength(0)
  })
})
