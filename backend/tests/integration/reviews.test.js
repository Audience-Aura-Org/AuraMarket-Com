'use strict'
/**
 * tests/integration/reviews.test.js
 * Prompt 8 — Review flows: public fetch, buyer submit, admin view & delete.
 *
 * Sections:
 *   1. GET  /reviews/product/:id    — public list of reviews for a product
 *   2. POST /reviews                — verified buyer submits a review
 *   3. GET  /reviews/admin          — admin-only view of all reviews
 *   4. DELETE /reviews/:id          — admin deletes a review + rating recalc
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                              = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin }                           = require('../factories')
const { signToken, authHeader }                 = require('../helpers/auth')

const User    = require('../../models/User.model')
const Vendor  = require('../../models/Vendor.model')
const Product = require('../../models/Product.model')
const Order   = require('../../models/Order.model')
const Review  = require('../../models/Review.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, vendorDoc, customer, admin, productId

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

  // Insert a product via raw collection to bypass pre-save hook
  productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:         productId,
    vendor_id:   vendorDoc._id,
    name:        faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price:       5_000,
    stock:       10,
    status:      'active',
    category:    'Electronics',
    images:      [],
    meal:        null,
    is_meal:     false,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Create a completed Order that allows the customer to review the product. */
const makeCompletedOrder = (overrides = {}) =>
  Order.create({
    customer_id:    customer._id,
    vendor_id:      vendorDoc._id,
    products: [{
      product_id:    productId,
      name:          'Test Product',
      quantity:      1,
      price:         5_000,
      regular_price: 5_000,
    }],
    subtotal:       5_000,
    shipping_fee:   0,
    total_amount:   5_000,
    payment_method: 'wallet',
    payment_status: 'paid',
    order_status:   'completed',
    ...overrides,
  })

/** Create a Review directly in the DB (bypasses HTTP layer). */
const makeReview = (orderId, overrides = {}) =>
  Review.create({
    user_id:    customer._id,
    product_id: productId,
    order_id:   orderId,
    rating:     4,
    comment:    'Great product!',
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /reviews/product/:id — public review list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /reviews/product/:id — public review list', () => {
  it('returns an empty list when no reviews exist for the product', async () => {
    const res = await request(app).get(`/api/v1/reviews/product/${productId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBe(0)
    expect(res.body.data.reviews).toHaveLength(0)
  })

  it('returns existing reviews with populated user data', async () => {
    const order = await makeCompletedOrder()
    await makeReview(order._id)

    const res = await request(app).get(`/api/v1/reviews/product/${productId}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    const review = res.body.data.reviews[0]
    expect(review.rating).toBe(4)
    expect(review.comment).toBe('Great product!')
    expect(review.user_id).toBeDefined() // populated
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /reviews — verified buyer submits a review
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /reviews — submit a review', () => {
  it('creates a review for a completed order and returns 201', async () => {
    const order = await makeCompletedOrder()

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeader(signToken(customer)))
      .send({
        product_id: productId,
        order_id:   order._id,
        rating:     5,
        comment:    'Excellent quality, very happy with purchase.',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.review.rating).toBe(5)
  })

  it('returns 403 when the order is not completed or does not belong to the user', async () => {
    // Order with wrong customer
    const otherCustomer = await createUser()
    const order = await Order.create({
      customer_id:    otherCustomer._id,
      vendor_id:      vendorDoc._id,
      products: [{
        product_id: productId, name: 'Test', quantity: 1, price: 5000, regular_price: 5000
      }],
      subtotal:       5_000,
      shipping_fee:   0,
      total_amount:   5_000,
      payment_method: 'wallet',
      payment_status: 'paid',
      order_status:   'completed',
    })

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeader(signToken(customer)))  // customer is not the order's buyer
      .send({ product_id: productId, order_id: order._id, rating: 3, comment: 'ok' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when the user tries to review the same order+product twice', async () => {
    const order = await makeCompletedOrder()
    await makeReview(order._id)  // first review already in DB

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(authHeader(signToken(customer)))
      .send({
        product_id: productId,
        order_id:   order._id,
        rating:     2,
        comment:    'Changed my mind.',
      })

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /reviews/admin — admin-only view
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /reviews/admin — admin-only review list', () => {
  it('returns all reviews to an admin user', async () => {
    const order = await makeCompletedOrder()
    await makeReview(order._id)

    const res = await request(app)
      .get('/api/v1/reviews/admin')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.count).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 when a non-admin user calls the admin review list', async () => {
    const res = await request(app)
      .get('/api/v1/reviews/admin')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE /reviews/:id — admin deletes a review
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /reviews/:id — admin deletes a review', () => {
  it('deletes the review and recalculates product rating', async () => {
    const order = await makeCompletedOrder()
    const review = await makeReview(order._id)

    // Seed a rating on the product so we can verify recalc resets it
    await Product.findByIdAndUpdate(productId, { rating: 4, num_reviews: 1 })

    const res = await request(app)
      .delete(`/api/v1/reviews/${review._id}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Review should be gone
    const deleted = await Review.findById(review._id)
    expect(deleted).toBeNull()

    // Product rating should be reset to 0 (no remaining reviews)
    const updatedProduct = await Product.findById(productId)
    expect(updatedProduct.num_reviews).toBe(0)
    expect(updatedProduct.rating).toBe(0)
  })

  it('returns 404 for a non-existent review ID', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/reviews/${fakeId}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(404)
  })
})
