'use strict'
/**
 * tests/integration/logistics.test.js
 * Prompt 6 — Logistics flows: onboard, shipment listing, status progression, settlement.
 *
 * Sections:
 *   1. POST /logistics/onboard   — create + idempotent update
 *   2. GET  /logistics           — public firm discovery
 *   3. GET  /logistics/zones     — public zone list
 *   4. GET  /logistics/shipments/firm — list with role guard
 *   5. GET  /logistics/shipments/:id  — single shipment + ownership guard
 *   6. PATCH /logistics/shipments/:id/status — status progression + financial settlement
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')
const crypto    = require('crypto')

const { buildApp }                          = require('../setup/app')
const { createUser, createVendorUser,
        createLogisticsUser, createOrder }  = require('../factories')
const { signToken, authHeader }             = require('../helpers/auth')

const User              = require('../../models/User.model')
const Vendor            = require('../../models/Vendor.model')
const LogisticsCompany  = require('../../models/LogisticsCompany.model')
const Shipment          = require('../../models/Shipment.model')
const LogisticZone      = require('../../models/LogisticZone.model')
const PlatformSettings  = require('../../models/PlatformSettings.model')
const Category          = require('../../models/Category.model')
const Product           = require('../../models/Product.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures rebuilt before every test
// ─────────────────────────────────────────────────────────────────────────────
let logisticsUser, logisticsFirm, vendorUser, vendorDoc, customer

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])

  logisticsUser = await createLogisticsUser()
  logisticsFirm = await LogisticsCompany.create({
    user_id:        logisticsUser._id,
    company_name:   'FastShip Ltd',
    contact_email:  faker.internet.email().toLowerCase(),
    contact_phone:  '+237600000099',
    service_regions: ['Yaounde'],
    vehicle_types:  ['motorcycle'],
    is_verified:    true,
  })

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

const makeOrder = (extras = {}) =>
  createOrder(
    { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
    {
      payment_method:   'wallet',
      payment_status:   'paid',
      shipping_method:  'logistics_partner',
      logistics_company_id: logisticsFirm._id,
      subtotal:         5_000,
      shipping_fee:     500,
      total_amount:     5_500,
      ...extras,
    },
  )

const makeShipment = (orderId, extras = {}) =>
  Shipment.create({
    order_id:    orderId,
    vendor_id:   vendorDoc._id,
    logistics_id: logisticsFirm._id,
    tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    price:       500,
    status:      'assigned',
    shipment_logs: [],
    ...extras,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /logistics/onboard
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /logistics/onboard', () => {
  it('creates a new logistics company profile and returns 201', async () => {
    const freshLogistics = await createLogisticsUser()

    const res = await request(app)
      .post('/api/v1/logistics/onboard')
      .set(authHeader(signToken(freshLogistics)))
      .send({
        company_name:    'QuickRide Express',
        contact_email:   'quickride@example.com',
        contact_phone:   '+237600000100',
        service_regions: ['Douala'],
        vehicle_types:   ['van'],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.company.company_name).toBe('QuickRide Express')
    expect(res.body.data.user.onboarded).toBe(true)
  })

  it('updates an existing profile (idempotent) and returns 200', async () => {
    // logisticsFirm already exists for logisticsUser (created in beforeEach)
    const res = await request(app)
      .post('/api/v1/logistics/onboard')
      .set(authHeader(signToken(logisticsUser)))
      .send({
        company_name:    'FastShip Ltd Updated',
        contact_email:   'updated@fastship.com',
        contact_phone:   '+237600000098',
        service_regions: ['Yaounde', 'Douala'],
        vehicle_types:   ['car'],
      })

    expect(res.status).toBe(200)
    expect(res.body.data.company.company_name).toBe('FastShip Ltd Updated')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /logistics — public firm list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logistics — public firm list', () => {
  it('returns verified logistics firms without authentication', async () => {
    const res = await request(app).get('/api/v1/logistics')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.firms)).toBe(true)
    // logisticsFirm is_verified: true → should appear
    expect(res.body.data.firms.length).toBeGreaterThanOrEqual(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /logistics/zones — public zone list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logistics/zones', () => {
  it('returns an array (possibly empty) without authentication', async () => {
    // Insert a zone so the response has something to verify shape
    await LogisticZone.create({ name: 'Yaounde', type: 'city', is_active: true })

    const res = await request(app).get('/api/v1/logistics/zones')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.zones)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /logistics/shipments/firm — firm's assigned shipments
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logistics/shipments/firm', () => {
  it('returns the firm\'s shipments for an authenticated logistics user', async () => {
    const order     = await makeOrder()
    await makeShipment(order._id)

    const res = await request(app)
      .get('/api/v1/logistics/shipments/firm')
      .set(authHeader(signToken(logisticsUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.shipments.length).toBeGreaterThanOrEqual(1)
  })

  it('blocks a customer with 403', async () => {
    const res = await request(app)
      .get('/api/v1/logistics/shipments/firm')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /logistics/shipments/:id — single shipment detail
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logistics/shipments/:id', () => {
  it('returns shipment detail for the owning logistics firm', async () => {
    const order    = await makeOrder()
    const shipment = await makeShipment(order._id)

    const res = await request(app)
      .get(`/api/v1/logistics/shipments/${shipment._id}`)
      .set(authHeader(signToken(logisticsUser)))

    expect(res.status).toBe(200)
    expect(res.body.data.shipment._id).toBe(shipment._id.toString())
  })

  it('blocks access from a different logistics firm (403)', async () => {
    const otherFirmUser = await createLogisticsUser()
    await LogisticsCompany.create({
      user_id:       otherFirmUser._id,
      company_name:  'Rival Firm',
      contact_email: faker.internet.email().toLowerCase(),
      contact_phone: '+237600000001',
      vehicle_types: ['motorcycle'],
    })

    const order    = await makeOrder()
    const shipment = await makeShipment(order._id)

    const res = await request(app)
      .get(`/api/v1/logistics/shipments/${shipment._id}`)
      .set(authHeader(signToken(otherFirmUser)))

    expect(res.status).toBe(403)
  })

  it('returns 400 for an invalid shipment id format', async () => {
    const res = await request(app)
      .get('/api/v1/logistics/shipments/not-an-objectid')
      .set(authHeader(signToken(logisticsUser)))

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PATCH /logistics/shipments/:id/status
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /logistics/shipments/:id/status — status progression', () => {
  it('advances shipment to in_transit and sets order status to shipped', async () => {
    const order    = await makeOrder()
    const shipment = await makeShipment(order._id, { status: 'picked_up' })

    const res = await request(app)
      .patch(`/api/v1/logistics/shipments/${shipment._id}/status`)
      .set(authHeader(signToken(logisticsUser)))
      .send({ status: 'in_transit', note: 'Moving to hub' })

    expect(res.status).toBe(200)
    expect(res.body.data.shipment.status).toBe('in_transit')

    const updatedOrder = await mongoose.model('Order').findById(order._id)
    expect(updatedOrder.order_status).toBe('shipped')
  })

  it('rejects delivery without proof_image or note', async () => {
    const order    = await makeOrder()
    const shipment = await makeShipment(order._id, { status: 'out_for_delivery' })

    const res = await request(app)
      .patch(`/api/v1/logistics/shipments/${shipment._id}/status`)
      .set(authHeader(signToken(logisticsUser)))
      .send({ status: 'delivered' }) // no proof_image, no note

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Proof of delivery/i)
  })

  it('rejects failed status without failure_reason', async () => {
    const order    = await makeOrder()
    const shipment = await makeShipment(order._id, { status: 'out_for_delivery' })

    const res = await request(app)
      .patch(`/api/v1/logistics/shipments/${shipment._id}/status`)
      .set(authHeader(signToken(logisticsUser)))
      .send({ status: 'failed' }) // no failure_reason

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Reason for failure/i)
  })

  it('rejects updates on non-logistics-partner orders', async () => {
    const vendorManagedOrder = await createOrder(
      { customerId: customer._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'wallet', payment_status: 'paid', shipping_method: 'vendor_managed',
        subtotal: 5_000, total_amount: 5_000 },
    )
    // Create a shipment referencing this non-logistics order
    const shipment = await makeShipment(vendorManagedOrder._id)

    const res = await request(app)
      .patch(`/api/v1/logistics/shipments/${shipment._id}/status`)
      .set(authHeader(signToken(logisticsUser)))
      .send({ status: 'in_transit' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/vendor-managed/i)
  })
})

describe('PATCH /logistics/shipments/:id/status — COD delivery settlement', () => {
  it('credits vendor wallet on COD order delivery', async () => {
    const codOrder = await makeOrder({
      payment_method:  'pay_on_delivery',
      payment_status:  'pending',
      subtotal:        5_000,
      shipping_fee:    500,
      total_amount:    5_500,
    })
    const shipment = await makeShipment(codOrder._id, { status: 'out_for_delivery' })

    const vendorBefore = await User.findById(vendorUser._id)

    const res = await request(app)
      .patch(`/api/v1/logistics/shipments/${shipment._id}/status`)
      .set(authHeader(signToken(logisticsUser)))
      .send({ status: 'delivered', note: 'Handed to customer', proof_image: 'https://cdn.test/proof.jpg' })

    expect(res.status).toBe(200)

    // Vendor wallet should be credited with order.subtotal (COD + logistics → subtotal only)
    const vendorAfter = await User.findById(vendorUser._id)
    expect(vendorAfter.wallet_balance).toBeGreaterThan(vendorBefore.wallet_balance)

    // Order completed
    const updatedOrder = await mongoose.model('Order').findById(codOrder._id)
    expect(updatedOrder.order_status).toBe('completed')
    expect(updatedOrder.payment_status).toBe('paid')
  })
})
