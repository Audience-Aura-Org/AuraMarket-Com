'use strict'
/**
 * tests/concurrency/orders.test.js
 * Verifies MongoDB-level atomicity for the two main order race conditions:
 *
 *  1. Coupon race  — max_uses=1 coupon used by N concurrent checkouts → exactly 1 wins
 *  2. Stock race   — last-in-stock item purchased by N concurrent ops   → exactly 1 wins
 *
 * These tests bypass the HTTP layer and exercise the Mongoose operations
 * directly, which is the same pattern used in order.controller.js.
 * Running this project with fileParallelism: false ensures serial execution.
 */

const mongoose = require('mongoose')
const Coupon   = require('../../models/Coupon.model')
const Product  = require('../../models/Product.model')
const { race, countOk, countFailed, assertExactlyNSucceeded } = require('../helpers/concurrency')
const { createUser }   = require('../factories/user.factory')
const { createVendor } = require('../factories/vendor.factory')

// ─────────────────────────────────────────────────────────────────────────────
// Coupon race — atomic findOneAndUpdate with $lt guard
// ─────────────────────────────────────────────────────────────────────────────

describe('Coupon atomicity — max_uses=1 race', () => {
  it('allows exactly 1 of 10 concurrent redemptions to succeed', async () => {
    const coupon = await Coupon.create({
      code:          `RACE-${Date.now()}`,
      discount_type: 'fixed',
      discount_value: 500,
      max_uses:      1,
      used_count:    0,
      is_active:     true,
      expiry_date:    new Date(Date.now() + 86_400_000),
    })

    // Mimic order.controller.js coupon claim: atomic findOneAndUpdate with $lt guard
    const claimCoupon = async () => {
      const updated = await Coupon.findOneAndUpdate(
        { _id: coupon._id, used_count: { $lt: coupon.max_uses } },
        { $inc: { used_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Coupon exhausted')
      return updated
    }

    const results = await race(10, claimCoupon)

    assertExactlyNSucceeded(results, 1)

    // DB should reflect exactly 1 use
    const final = await Coupon.findById(coupon._id).lean()
    expect(final.used_count).toBe(1)
  })

  it('allows exactly 3 of 10 concurrent redemptions when max_uses=3', async () => {
    const coupon = await Coupon.create({
      code:          `RACE3-${Date.now()}`,
      discount_type: 'percentage',
      discount_value: 10,
      max_uses:      3,
      used_count:    0,
      is_active:     true,
      expiry_date:    new Date(Date.now() + 86_400_000),
    })

    const claimCoupon = async () => {
      const updated = await Coupon.findOneAndUpdate(
        { _id: coupon._id, used_count: { $lt: coupon.max_uses } },
        { $inc: { used_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Coupon exhausted')
      return updated
    }

    const results = await race(10, claimCoupon)

    assertExactlyNSucceeded(results, 3)

    const final = await Coupon.findById(coupon._id).lean()
    expect(final.used_count).toBe(3)
  })

  it('is idempotent — a coupon with used_count already at max_uses rejects all attempts', async () => {
    const coupon = await Coupon.create({
      code:          `RACE-FULL-${Date.now()}`,
      discount_type: 'fixed',
      discount_value: 200,
      max_uses:      1,
      used_count:    1, // already at limit
      is_active:     true,
      expiry_date:    new Date(Date.now() + 86_400_000),
    })

    const claimCoupon = async () => {
      const updated = await Coupon.findOneAndUpdate(
        { _id: coupon._id, used_count: { $lt: coupon.max_uses } },
        { $inc: { used_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Coupon exhausted')
      return updated
    }

    const results = await race(5, claimCoupon)
    expect(countOk(results)).toBe(0)
    expect(countFailed(results)).toBe(5)

    const final = await Coupon.findById(coupon._id).lean()
    expect(final.used_count).toBe(1) // unchanged
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stock race — atomic findOneAndUpdate with $gte guard
// ─────────────────────────────────────────────────────────────────────────────

// Helper: insert a raw product doc bypassing Mongoose pre-save hooks (which
// require meal.booking_options on any product that has a `meal` subdoc).
// The atomic findOneAndUpdate calls we test do NOT trigger pre-save hooks.
const insertTestProduct = async (vendorId, fields) => {
  const _id = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id,
    vendor_id:      vendorId,
    purchase_count: 0,
    status:         'active',
    category:       new mongoose.Types.ObjectId(),
    createdAt:      new Date(),
    updatedAt:      new Date(),
    ...fields,
  })
  return { _id }
}

describe('Stock deduction atomicity — last-in-stock race', () => {
  it('allows exactly 1 of 10 concurrent buyers to purchase the last unit', async () => {
    const { vendor } = await createVendor()
    const product = await insertTestProduct(vendor._id, {
      name:        `Last-Unit-${Date.now()}`,
      description: 'race test product',
      price:       1000,
      stock:       1,   // only one left
    })

    // Mimic order.controller.js atomic stock deduction for a simple product
    const buyOneUnit = async () => {
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, status: 'active', stock: { $gte: 1 } },
        { $inc: { stock: -1, purchase_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Out of stock')
      return updated
    }

    const results = await race(10, buyOneUnit)

    assertExactlyNSucceeded(results, 1)

    // DB stock must be exactly 0 — no negative stock
    const final = await Product.findById(product._id).lean()
    expect(final.stock).toBe(0)
    expect(final.purchase_count).toBe(1)
  })

  it('allows exactly 3 of 10 buyers to purchase when stock=3', async () => {
    const { vendor } = await createVendor()
    const product = await insertTestProduct(vendor._id, {
      name:        `Stock3-${Date.now()}`,
      description: 'race test product',
      price:       500,
      stock:       3,
    })

    const buyOneUnit = async () => {
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, status: 'active', stock: { $gte: 1 } },
        { $inc: { stock: -1, purchase_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Out of stock')
      return updated
    }

    const results = await race(10, buyOneUnit)

    assertExactlyNSucceeded(results, 3)

    const final = await Product.findById(product._id).lean()
    expect(final.stock).toBe(0)
    expect(final.purchase_count).toBe(3)
  })

  it('stock never goes negative', async () => {
    const { vendor } = await createVendor()
    const product = await insertTestProduct(vendor._id, {
      name:        `Stock-Floor-${Date.now()}`,
      description: 'negative stock guard',
      price:       750,
      stock:       2,
    })

    // 20 concurrent attempts — only 2 should succeed
    const buyOneUnit = async () => {
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, status: 'active', stock: { $gte: 1 } },
        { $inc: { stock: -1, purchase_count: 1 } },
        { new: true },
      )
      if (!updated) throw new Error('Out of stock')
      return updated
    }

    const results = await race(20, buyOneUnit)
    assertExactlyNSucceeded(results, 2)

    const final = await Product.findById(product._id).lean()
    expect(final.stock).toBeGreaterThanOrEqual(0) // must never go negative
    expect(final.stock).toBe(0)
  })
})
