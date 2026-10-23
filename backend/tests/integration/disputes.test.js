'use strict'
/**
 * tests/integration/disputes.test.js
 * Prompt 6 — Dispute flows: create, list, admin resolve.
 *
 * Sections:
 *   1. POST /disputes              — create + guard rails
 *   2. GET  /disputes/customer     — scoped to initiator
 *   3. GET  /disputes/admin        — admin only
 *   4. PATCH /admin/disputes/:id/resolve — full_refund + release_payment + guards
 */

const request    = require('supertest')
const mongoose   = require('mongoose')
const { faker }  = require('@faker-js/faker')

const { buildApp }                             = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin, createOrder }             = require('../factories')
const { signToken, authHeader }                = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const Escrow           = require('../../models/Escrow.model')
const Dispute          = require('../../models/Dispute.model')
const Order            = require('../../models/Order.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures — rebuilt fresh for every test
// ─────────────────────────────────────────────────────────────────────────────
let customer, vendorUser, vendorDoc

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
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

  customer = await createUser({ wallet_balance: 50_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const makeEscrowOrder = () =>
  createOrder(
    { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
    { payment_method: 'escrow', total_amount: 5_000, subtotal: 5_000, shipping_fee: 0,
      shipping_method: 'vendor_managed',
      shipping_address: { name: 'Alice', phone: '+237600000001', city: 'Yaounde', quartier: 'Bastos' } },
  )

// Hold escrow via API (creates the Escrow record properly)
const holdEscrow = (order) =>
  request(app)
    .post('/api/v1/escrow/hold')
    .set(authHeader(signToken(customer)))
    .send({ order_id: order._id.toString() })

// Create + hold an escrow order (returns { order, escrowDoc })
const setupHeldEscrow = async () => {
  const order = await makeEscrowOrder()
  await holdEscrow(order)
  const escrowDoc = await Escrow.findOne({ order_id: order._id })
  return { order, escrowDoc }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /disputes — create a dispute
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /disputes — create', () => {
  it('creates a dispute and marks order as refund_pending', async () => {
    const order = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 3_000 },
    )

    const res = await request(app)
      .post('/api/v1/disputes')
      .set(authHeader(signToken(customer)))
      .send({ order_id: order._id, reason: 'item_not_received', description: 'Never arrived.' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.dispute).toBeDefined()
    expect(res.body.data.dispute.status).toBe('pending')

    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('refund_pending')
  })

  it('prevents a duplicate active dispute for the same order', async () => {
    const order = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 3_000 },
    )

    await request(app)
      .post('/api/v1/disputes')
      .set(authHeader(signToken(customer)))
      .send({ order_id: order._id, reason: 'item_not_received', description: 'Item never arrived.' })

    // Second attempt
    const res = await request(app)
      .post('/api/v1/disputes')
      .set(authHeader(signToken(customer)))
      .send({ order_id: order._id, reason: 'faulty_item', description: 'Item is faulty.' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already open/i)
  })

  it('blocks a user from disputing someone else\'s order (403)', async () => {
    const stranger = await createUser()
    const order    = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 3_000 },
    )

    const res = await request(app)
      .post('/api/v1/disputes')
      .set(authHeader(signToken(stranger)))
      .send({ order_id: order._id, reason: 'item_not_received' })

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent order', async () => {
    const res = await request(app)
      .post('/api/v1/disputes')
      .set(authHeader(signToken(customer)))
      .send({ order_id: new mongoose.Types.ObjectId(), reason: 'other' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /disputes/customer — scoped list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /disputes/customer', () => {
  it("returns only the authenticated user's disputes", async () => {
    const otherCustomer = await createUser()

    // customer creates 2 disputes; otherCustomer creates 1
    const orderA = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 2_000 },
    )
    const orderB = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 3_000 },
    )
    const orderC = await createOrder(
      { customerId: otherCustomer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 4_000 },
    )

    await Dispute.create([
      { order_id: orderA._id, initiator_id: customer._id,      reason: 'item_not_received', description: 'Not received.', status: 'pending' },
      { order_id: orderB._id, initiator_id: customer._id,      reason: 'faulty_item',      description: 'Arrived broken.', status: 'pending' },
      { order_id: orderC._id, initiator_id: otherCustomer._id, reason: 'other',             description: 'Other issue.', status: 'pending' },
    ])

    const res = await request(app)
      .get('/api/v1/disputes/customer')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.data.disputes).toHaveLength(2)
    for (const d of res.body.data.disputes) {
      expect(d.initiator_id).toBe(customer._id.toString())
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /disputes/admin — admin only
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /disputes/admin', () => {
  it('returns all disputes for admin', async () => {
    const admin = await createAdmin()
    const order = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', total_amount: 3_000 },
    )
    await Dispute.create({ order_id: order._id, initiator_id: customer._id, reason: 'other', description: 'Test dispute.', status: 'pending' })

    const res = await request(app)
      .get('/api/v1/disputes/admin')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.data.disputes.length).toBeGreaterThanOrEqual(1)
  })

  it('blocks non-admin with 403', async () => {
    const res = await request(app)
      .get('/api/v1/disputes/admin')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /admin/disputes/:id/resolve
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/disputes/:id/resolve', () => {
  it('full_refund credits buyer wallet and refunds escrow', async () => {
    const admin = await createAdmin()
    const { order, escrowDoc } = await setupHeldEscrow()

    const dispute = await Dispute.create({
      order_id:     order._id,
      initiator_id: customer._id,
      reason:       'item_not_received',
      description:  'Item never arrived.',
      status:       'pending',
    })

    const customerBefore = await User.findById(customer._id)

    const res = await request(app)
      .patch(`/api/v1/admin/disputes/${dispute._id}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ resolution_type: 'full_refund', admin_notes: 'Customer wins.' })

    expect(res.status).toBe(200)
    expect(res.body.data.dispute.status).toBe('resolved')
    expect(res.body.data.dispute.resolution_type).toBe('full_refund')

    // Customer wallet restored
    const customerAfter = await User.findById(customer._id)
    expect(customerAfter.wallet_balance).toBeGreaterThan(customerBefore.wallet_balance)

    // Escrow status updated
    const updatedEscrow = await Escrow.findById(escrowDoc._id)
    expect(updatedEscrow.status).toBe('refunded')

    // Order refunded
    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('refunded')
  })

  it('release_payment credits vendor wallet and marks escrow released', async () => {
    const admin = await createAdmin()
    const { order, escrowDoc } = await setupHeldEscrow()

    const dispute = await Dispute.create({
      order_id:     order._id,
      initiator_id: customer._id,
      reason:       'faulty_item',
      description:  'Item arrived damaged.',
      status:       'pending',
    })

    const vendorBefore = await User.findById(vendorUser._id)

    const res = await request(app)
      .patch(`/api/v1/admin/disputes/${dispute._id}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ resolution_type: 'release_payment', admin_notes: 'Vendor wins.' })

    expect(res.status).toBe(200)

    // Vendor wallet credited
    const vendorAfter = await User.findById(vendorUser._id)
    expect(vendorAfter.wallet_balance).toBeGreaterThan(vendorBefore.wallet_balance)

    // Escrow released
    const updatedEscrow = await Escrow.findById(escrowDoc._id)
    expect(updatedEscrow.status).toBe('released')

    // Order completed
    const updatedOrder = await Order.findById(order._id)
    expect(updatedOrder.order_status).toBe('completed')
  })

  it('rejects resolving an already-resolved dispute', async () => {
    const admin = await createAdmin()
    const { order } = await setupHeldEscrow()

    const dispute = await Dispute.create({
      order_id:        order._id,
      initiator_id:    customer._id,
      reason:          'other',
      description:     'Already resolved dispute.',
      status:          'resolved', // already done
      resolution_type: 'full_refund',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/disputes/${dispute._id}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ resolution_type: 'full_refund' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already been resolved/i)
  })

  it('rejects a resolution type without a complete settlement workflow', async () => {
    const admin = await createAdmin()
    const { order } = await setupHeldEscrow()
    const customer = await User.findById(order.customer_id)
    const dispute = await Dispute.create({
      order_id: order._id,
      initiator_id: customer._id,
      reason: 'other',
      description: 'Unsupported resolution regression.',
      status: 'pending',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/disputes/${dispute._id}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ resolution_type: 'partial_refund' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/unsupported dispute resolution/i)
    expect((await Dispute.findById(dispute._id)).status).toBe('pending')
  })

  it('blocks non-admin with 403', async () => {
    const dispute = await Dispute.create({
      order_id:     new mongoose.Types.ObjectId(),
      initiator_id: customer._id,
      reason:       'other',
      description:  'Unauthorized access test.',
      status:       'pending',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/disputes/${dispute._id}/resolve`)
      .set(authHeader(signToken(customer)))
      .send({ resolution_type: 'full_refund' })

    expect(res.status).toBe(403)
  })
})

describe('dispute and settlement coordination', () => {
  const paidOrder = () => createOrder(
    { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
    { payment_method: 'escrow', payment_status: 'paid', order_status: 'delivered', subtotal: 3000, total_amount: 3000, shipping_fee: 0 },
  )
  const escrowFor = (order, status = 'held') => Escrow.create({ order_id: order._id, buyer_id: customer._id, vendor_id: vendorDoc._id, amount: 3000, status })
  const disputeOrder = order => request(app).post('/api/v1/disputes').set(authHeader(signToken(customer))).send({ order_id: order._id, reason: 'faulty_item', description: 'Item arrived damaged.' })

  it('rejects an escrow dispute after release without changing the order', async () => {
    const order = await paidOrder()
    await escrowFor(order, 'released')
    const result = await disputeOrder(order)
    expect(result.status).toBe(409)
    expect(await Dispute.countDocuments({ order_id: order._id })).toBe(0)
    expect((await Order.findById(order._id)).order_status).toBe('delivered')
  })
  it('claims escrow as disputed and permits an admin refund exactly once', async () => {
    const admin = await createAdmin()
    const order = await paidOrder()
    await escrowFor(order)
    const created = await disputeOrder(order)
    expect(created.status).toBe(201)
    expect((await Escrow.findOne({ order_id: order._id })).status).toBe('disputed')
    const before = (await User.findById(customer._id)).wallet_balance
    const path = '/api/v1/admin/disputes/' + created.body.data.dispute._id + '/resolve'
    const resolved = await request(app).patch(path).set(authHeader(signToken(admin))).send({ resolution_type: 'full_refund' })
    expect(resolved.status).toBe(200)
    expect((await User.findById(customer._id)).wallet_balance).toBe(before + 3000)
    const replay = await request(app).patch(path).set(authHeader(signToken(admin))).send({ resolution_type: 'full_refund' })
    expect(replay.status).toBe(400)
    expect((await User.findById(customer._id)).wallet_balance).toBe(before + 3000)
  })
  it('allows only one active dispute under concurrent duplicate requests', async () => {
    const order = await paidOrder()
    await escrowFor(order)
    const responses = await Promise.all([disputeOrder(order), disputeOrder(order)])
    expect(responses.filter(response => response.status === 201)).toHaveLength(1)
    expect(await Dispute.countDocuments({ order_id: order._id })).toBe(1)
  })
  it('never leaves an active dispute after a competing escrow payout', async () => {
    const order = await paidOrder()
    await escrowFor(order)
    await Promise.all([
      disputeOrder(order),
      request(app).post('/api/v1/escrow/release/' + order._id).set(authHeader(signToken(customer))),
    ])
    const escrow = await Escrow.findOne({ order_id: order._id })
    const count = await Dispute.countDocuments({ order_id: order._id, status: 'pending' })
    if (escrow.status === 'released') expect(count).toBe(0)
    else { expect(escrow.status).toBe('disputed'); expect(count).toBe(1) }
  })
})
