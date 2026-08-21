'use strict'
/**
 * tests/integration/escrow.test.js
 * Prompt 5 — Escrow lifecycle: hold, confirm-delivery, release, deny, refund.
 *
 * Each test works from a fresh DB (afterEach wipes everything).
 * A shared beforeEach scaffolds: PlatformSettings + Vendor + Product + Customer + Order.
 *
 * Sections:
 *   1. POST /escrow/hold               — fund escrow from wallet; guard rails
 *   2. POST /escrow/confirm-delivery   — vendor marks delivered; role + ownership guards
 *   3. POST /escrow/release            — customer releases funds; ownership guard
 *   4. POST /escrow/deny               — open a dispute; auth guard
 *   5. POST /escrow/refund             — vendor/admin refunds; role guard
 */

const request    = require('supertest')
const mongoose   = require('mongoose')
const { faker }  = require('@faker-js/faker')

const { buildApp }                        = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin, createOrder }        = require('../factories')
const { signToken, authHeader }           = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const Escrow           = require('../../models/Escrow.model')
const Order            = require('../../models/Order.model')
const Category         = require('../../models/Category.model')
const Product          = require('../../models/Product.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

// ─────────────────────────────────────────────────────────────────────────────
// Shared app instance
// ─────────────────────────────────────────────────────────────────────────────
let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — rebuilt fresh before every test
// ─────────────────────────────────────────────────────────────────────────────
let customer, vendorUser, vendorDoc, product, order

beforeEach(async () => {
  // PlatformSettings required by holdFunds → getEffectivePlatformSettings
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])

  // Category
  const cat = await Category.create({ name: faker.commerce.department(), slug: faker.lorem.slug() })

  // Vendor
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

  // Product — raw insert to bypass meal pre-save hook
  const productId = new mongoose.Types.ObjectId()
  await Product.collection.insertOne({
    _id:            productId,
    vendor_id:      vendorDoc._id,
    name:           faker.commerce.productName(),
    description:    faker.commerce.productDescription(),
    price:          5_000,
    stock:          50,
    status:         'active',
    category:       cat.name,
    category_id:    cat._id,
    purchase_count: 0,
    images:         [],
    meal:           null, // explicit null → pre-save hook skips meal validation
    createdAt:      new Date(),
    updatedAt:      new Date(),
  })
  product = { _id: productId }

  // Customer with enough balance to cover the order
  customer = await createUser({ wallet_balance: 50_000 })

  // Escrow order — 5 000 XAF, not yet paid
  order = await createOrder(
    { customerId: customer._id, vendorId: vendorDoc._id, productId: product._id },
    {
      payment_method:  'escrow',
      total_amount:    5_000,
      subtotal:        5_000,
      shipping_fee:    0,
      shipping_method: 'vendor_managed',
      shipping_address: { name: 'Alice', phone: '+237600000001', city: 'Yaounde', quartier: 'Bastos' },
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: hold the escrow — used by sections 2-5
// ─────────────────────────────────────────────────────────────────────────────
const holdEscrow = (customerDoc, orderId) =>
  request(app)
    .post('/api/v1/escrow/hold')
    .set(authHeader(signToken(customerDoc)))
    .send({ order_id: orderId.toString() })

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /escrow/hold
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /escrow/hold', () => {
  it('debits customer wallet and creates a held escrow', async () => {
    const res = await holdEscrow(customer, order._id)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Wallet debited
    const fresh = await User.findById(customer._id)
    expect(fresh.wallet_balance).toBe(45_000) // 50 000 − 5 000

    // Order updated
    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.payment_status).toBe('paid')
    expect(updatedOrder.order_status).toBe('processing')

    // Escrow created
    const escrow = await Escrow.findOne({ order_id: order._id })
    expect(escrow).not.toBeNull()
    expect(escrow.status).toBe('held')
  })

  it('rejects when the caller is not the order owner', async () => {
    const stranger = await createUser({ wallet_balance: 50_000 })

    const res = await request(app)
      .post('/api/v1/escrow/hold')
      .set(authHeader(signToken(stranger)))
      .send({ order_id: order._id.toString() })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Not authorized/i)
  })

  it('rejects when the order payment_method is not escrow', async () => {
    const podOrder = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: product._id },
      { payment_method: 'pay_on_delivery', total_amount: 2_000, subtotal: 2_000 },
    )

    const res = await request(app)
      .post('/api/v1/escrow/hold')
      .set(authHeader(signToken(customer)))
      .send({ order_id: podOrder._id.toString() })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/not designated for escrow/i)
  })

  it('rejects when the order has already been paid', async () => {
    const paidOrder = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: product._id },
      { payment_method: 'escrow', payment_status: 'paid', total_amount: 2_000, subtotal: 2_000 },
    )

    const res = await request(app)
      .post('/api/v1/escrow/hold')
      .set(authHeader(signToken(customer)))
      .send({ order_id: paidOrder._id.toString() })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already been processed/i)
  })

  it('rejects when wallet balance is insufficient', async () => {
    const poorCustomer = await createUser({ wallet_balance: 100 })
    const smallOrder   = await createOrder(
      { customerId: poorCustomer._id, vendorId: vendorDoc._id, productId: product._id },
      { payment_method: 'escrow', total_amount: 5_000, subtotal: 5_000 },
    )

    const res = await request(app)
      .post('/api/v1/escrow/hold')
      .set(authHeader(signToken(poorCustomer)))
      .send({ order_id: smallOrder._id.toString() })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Insufficient/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /escrow/confirm-delivery/:orderId
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /escrow/confirm-delivery/:orderId', () => {
  it('vendor confirms delivery — order moves to delivered and vendor_confirmed is set', async () => {
    await holdEscrow(customer, order._id)

    const res = await request(app)
      .post(`/api/v1/escrow/confirm-delivery/${order._id}`)
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('delivered')

    const escrow = await Escrow.findOne({ order_id: order._id })
    expect(escrow.vendor_confirmed).toBe(true)
  })

  it('blocks a customer from calling confirm-delivery (role guard → 403)', async () => {
    await holdEscrow(customer, order._id)

    const res = await request(app)
      .post(`/api/v1/escrow/confirm-delivery/${order._id}`)
      .set(authHeader(signToken(customer)))

    // restrictTo('vendor') — customer role rejected
    expect(res.status).toBe(403)
  })

  it('rejects a vendor who does not own the order', async () => {
    await holdEscrow(customer, order._id)

    const otherVendorUser = await createVendorUser()
    await Vendor.create({
      user_id:       otherVendorUser._id,
      store_name:    faker.company.name().slice(0, 100),
      description:   faker.lorem.sentence(),
      phone:         faker.phone.number(),
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    const res = await request(app)
      .post(`/api/v1/escrow/confirm-delivery/${order._id}`)
      .set(authHeader(signToken(otherVendorUser)))

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Not authorized/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /escrow/release/:orderId
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /escrow/release/:orderId', () => {
  it('customer releases funds — vendor wallet credited, escrow released, order completed', async () => {
    await holdEscrow(customer, order._id)

    const vendorBefore = await User.findById(vendorUser._id)

    const res = await request(app)
      .post(`/api/v1/escrow/release/${order._id}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Vendor wallet increased
    const vendorAfter = await User.findById(vendorUser._id)
    expect(vendorAfter.wallet_balance).toBeGreaterThan(vendorBefore.wallet_balance)

    // Escrow status
    const escrow = await Escrow.findOne({ order_id: order._id })
    expect(escrow.status).toBe('released')

    // Order completed
    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('completed')
  })

  it('rejects release by a user who is not the buyer', async () => {
    await holdEscrow(customer, order._id)

    const stranger = await createUser()

    const res = await request(app)
      .post(`/api/v1/escrow/release/${order._id}`)
      .set(authHeader(signToken(stranger)))

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Only the customer or an admin/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /escrow/deny/:orderId
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /escrow/deny/:orderId', () => {
  it('customer denies — dispute opened, escrow disputed, order refund_pending', async () => {
    await holdEscrow(customer, order._id)

    const res = await request(app)
      .post(`/api/v1/escrow/deny/${order._id}`)
      .set(authHeader(signToken(customer)))
      .send({ reason: 'item_not_received', description: 'Package never arrived.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.dispute).toBeDefined()

    const escrow = await Escrow.findOne({ order_id: order._id })
    expect(escrow.status).toBe('disputed')

    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('refund_pending')
  })

  it('rejects denial by an unauthorized user (not buyer, vendor, or admin)', async () => {
    await holdEscrow(customer, order._id)

    const interloper = await createUser() // plain customer unrelated to the order

    const res = await request(app)
      .post(`/api/v1/escrow/deny/${order._id}`)
      .set(authHeader(signToken(interloper)))
      .send({ reason: 'fraud' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Not authorized/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /escrow/refund/:orderId
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /escrow/refund/:orderId', () => {
  it('vendor refunds — customer wallet restored, escrow refunded, order cancelled', async () => {
    await holdEscrow(customer, order._id)

    const customerBefore = await User.findById(customer._id)

    const res = await request(app)
      .post(`/api/v1/escrow/refund/${order._id}`)
      .set(authHeader(signToken(vendorUser)))
      .send({ reason: 'Item out of stock' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Customer wallet restored (full order total)
    const customerAfter = await User.findById(customer._id)
    expect(customerAfter.wallet_balance).toBe(customerBefore.wallet_balance + 5_000)

    // Escrow refunded
    const escrow = await Escrow.findOne({ order_id: order._id })
    expect(escrow.status).toBe('refunded')

    // Order cancelled
    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('cancelled')
    expect(updatedOrder.payment_status).toBe('refunded')
  })

  it('blocks a customer from calling refund (role guard → 403)', async () => {
    await holdEscrow(customer, order._id)

    const res = await request(app)
      .post(`/api/v1/escrow/refund/${order._id}`)
      .set(authHeader(signToken(customer)))
      .send({ reason: 'Changed my mind' })

    // restrictTo('vendor', 'admin') — customer blocked
    expect(res.status).toBe(403)
  })
})
