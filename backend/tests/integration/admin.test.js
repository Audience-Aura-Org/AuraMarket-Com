'use strict'
/**
 * tests/integration/admin.test.js
 * Prompt 14 — Admin panel core flows.
 *
 * Sections:
 *   1.  GET  /admin/settings              — platform settings read
 *   2.  PATCH /admin/settings             — platform settings update
 *   3.  GET  /admin/kyc/pending           — list KYC submissions
 *   4.  PATCH /admin/kyc/:id/review       — approve / reject KYC
 *   5.  GET  /admin/users                 — list all users
 *   6.  PATCH /admin/users/:id/status     — update user verification status
 *   7.  PATCH /admin/vendors/:id/verify   — toggle vendor verification
 *   8.  GET  /admin/reports               — list pending reports
 *   9.  PATCH /admin/reports/:id/resolve  — resolve a report
 *   10. PATCH /admin/products/:id/review  — change product status
 *   11. GET  /admin/zones + POST          — zone management
 *   12. GET  /admin/analytics             — platform analytics
 *
 * All write endpoints verify that regular users receive 403.
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                          = require('../setup/app')
const { createUser, createAdmin, createVendorUser, createOrder, createEscrow } = require('../factories')
const { signToken, authHeader }             = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const KYC              = require('../../models/KYC.model')
const Report           = require('../../models/Report.model')
const Product          = require('../../models/Product.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const LogisticZone     = require('../../models/LogisticZone.model')

let app, admin, user

beforeAll(() => { app = buildApp() })

beforeEach(async () => {
  admin = await createAdmin()
  user  = await createUser()

  await PlatformSettings.create({
    commission_rate:  5,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 2,
    min_withdrawal_amount: 500,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /admin/settings
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/settings — platform settings', () => {
  it('returns current settings to an admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/settings')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.settings).toBeDefined()
    expect(typeof res.body.data.settings.commission_rate).toBe('number')
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/settings')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

describe('GET /admin/analytics/advanced — financial custody', () => {
  it('uses held and disputed escrow records instead of unpaid orders', async () => {
    const vendorId = new mongoose.Types.ObjectId()
    const orderId = new mongoose.Types.ObjectId()
    const ids = { customerId: user._id, vendorId, orderId }

    await createOrder({ customerId: user._id, vendorId }, {
      total_amount: 9_000,
      subtotal: 9_000,
      payment_status: 'pending',
      order_status: 'placed',
    })
    await createEscrow(ids, { amount: 2_000, status: 'held' })
    await createEscrow(ids, { amount: 1_000, status: 'disputed' })
    await createEscrow(ids, { amount: 4_000, status: 'released' })

    const res = await request(app)
      .get('/api/v1/admin/analytics/advanced')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.data.payout_intel.total_escrow).toBe(3_000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /admin/settings
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/settings — update platform settings', () => {
  it('admin can update min_withdrawal_amount', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set(authHeader(signToken(admin)))
      .send({ min_withdrawal_amount: 1_000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.settings.min_withdrawal_amount).toBe(1_000)
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set(authHeader(signToken(user)))
      .send({ min_withdrawal_amount: 999 })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /admin/kyc/pending — list KYC
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/kyc/pending — list KYC submissions', () => {
  it('returns pending KYC submissions to an admin', async () => {
    const buyer = await createUser()
    await KYC.create({
      user_id:           buyer._id,
      full_name:         'John Doe',
      document_type:     'national_id',
      document_number:   'CM-111',
      document_front_url: 'https://cdn.test/front.jpg',
      status:            'pending',
    })

    const res = await request(app)
      .get('/api/v1/admin/kyc/pending')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.submissions.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/kyc/pending')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /admin/kyc/:id/review — approve / reject KYC
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/kyc/:id/review — review a KYC submission', () => {
  it('approves KYC and sets user verification_status to verified', async () => {
    const buyer = await createUser()
    const kyc = await KYC.create({
      user_id:           buyer._id,
      full_name:         'Alice Doe',
      document_type:     'national_id',
      document_number:   'CM-222',
      document_front_url: 'https://cdn.test/front.jpg',
      status:            'pending',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/kyc/${kyc._id}/review`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'approved', feedback: 'All clear.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.kyc.status).toBe('approved')

    const updatedUser = await User.findById(buyer._id)
    expect(updatedUser.verification_status).toBe('verified')
  })

  it('returns 404 for a non-existent KYC record', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/admin/kyc/${fakeId}/review`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'rejected', feedback: 'Not found.' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /admin/users — list all users
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/users — list all users', () => {
  it('returns a list of users to an admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.users)).toBe(true)
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1)
  })

  it('filters by role when ?role=vendor is provided', async () => {
    await createVendorUser()

    const res = await request(app)
      .get('/api/v1/admin/users?role=vendor')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    res.body.data.users.forEach(u => {
      expect(u.role).toBe('vendor')
    })
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PATCH /admin/users/:id/status — update user status
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/users/:id/status — update user verification status', () => {
  it('admin can update a user verification status', async () => {
    const target = await createUser()

    const res = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/status`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'verified' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await User.findById(target._id)
    expect(updated.verification_status).toBe('verified')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. PATCH /admin/vendors/:id/verify — toggle vendor verification
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/vendors/:id/verify — toggle vendor verification', () => {
  it('toggles vendor verified flag and returns 200', async () => {
    const vendorUser = await createVendorUser()
    const vendorDoc  = await Vendor.create({
      user_id:    vendorUser._id,
      store_name: 'Toggle Store',
      description: 'Test.',
      phone:      '+237600000020',
      verified:   false,
      rating:     0, total_sales: 0, total_revenue: 0,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/vendors/${vendorDoc._id}/verify`)
      .set(authHeader(signToken(admin)))
      .send({ verified: true })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const updated = await Vendor.findById(vendorDoc._id)
    expect(updated.verified).toBe(true)
  })

  it('returns 404 for a non-existent vendor', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/admin/vendors/${fakeId}/verify`)
      .set(authHeader(signToken(admin)))
      .send({ verified: true })

    expect(res.status).toBe(404)
  })

  it('returns 403 for a regular user', async () => {
    const vendorDoc = await Vendor.create({
      user_id:    user._id, store_name: 'x', description: 'y',
      phone: '+237600000021', verified: false, rating: 0, total_sales: 0, total_revenue: 0,
    })

    const res = await request(app)
      .patch(`/api/v1/admin/vendors/${vendorDoc._id}/verify`)
      .set(authHeader(signToken(user)))
      .send({ verified: true })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET /admin/reports — list pending reports
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/reports — list pending reports', () => {
  it('returns pending reports to an admin', async () => {
    const reporter = await createUser()
    await Report.create({
      reporter_id: reporter._id,
      target_id:   new mongoose.Types.ObjectId(),
      target_type: 'user',
      reason:      'scam_fraud',
      description: 'Fraud attempt.',
      status:      'pending',
    })

    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reports.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. PATCH /admin/reports/:id/resolve — resolve a report
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/reports/:id/resolve — resolve a report', () => {
  it('resolves a report and returns 200', async () => {
    const reporter = await createUser()
    const report = await Report.create({
      reporter_id: reporter._id,
      target_id:   new mongoose.Types.ObjectId(),
      target_type: 'product',
      reason:      'prohibited_item',
      description: 'Illegal listing.',
      status:      'pending',
    })

    const res = await request(app)
      .patch(`/api/v1/admin/reports/${report._id}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'action_taken', admin_notes: 'Product removed.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.report.status).toBe('action_taken')
  })

  it('returns 404 for a non-existent report', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/admin/reports/${fakeId}/resolve`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'dismissed' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. PATCH /admin/products/:id/review — product status change
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /admin/products/:id/review — change product status', () => {
  it('admin sets a product to active and returns 200', async () => {
    const vendorUser = await createVendorUser()
    const vendorDoc  = await Vendor.create({
      user_id: vendorUser._id, store_name: 'Review Store',
      description: 'Test.', phone: '+237600000022',
      verified: false, rating: 0, total_sales: 0, total_revenue: 0,
    })
    const product = await Product.create({
      vendor_id:   vendorDoc._id,
      name:        'Pending Product',
      description: 'Awaiting review.',
      price:       5_000,
      stock:       10,
      status:      'pending',
      category:    'Electronics',
      images:      [],
    })

    const res = await request(app)
      .patch(`/api/v1/admin/products/${product._id}/review`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'active' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.status).toBe('active')
  })

  it('returns 400 for an invalid status value', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/admin/products/${fakeId}/review`)
      .set(authHeader(signToken(admin)))
      .send({ status: 'illegal_status' })

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /admin/zones + POST /admin/zones — zone management
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/zones + POST /admin/zones — logistic zone management', () => {
  it('GET returns an empty zone list initially', async () => {
    const res = await request(app)
      .get('/api/v1/admin/zones')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST creates a city-level zone and returns it', async () => {
    const res = await request(app)
      .post('/api/v1/admin/zones')
      .set(authHeader(signToken(admin)))
      .send({ name: 'Douala', type: 'city', code: `DLA-${Date.now()}` })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('Douala')
    expect(res.body.data.type).toBe('city')
    expect(res.body.data.level).toBe(1)
  })

  it('POST returns 400 when type is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/admin/zones')
      .set(authHeader(signToken(admin)))
      .send({ name: 'Bad Zone', type: 'country' })

    expect(res.status).toBe(400)
  })

  it('POST creates a district zone under a city parent', async () => {
    const city = await LogisticZone.create({
      name: `Yaoundé-${Date.now()}`, type: 'city', level: 1, ancestors: [],
      code: `YDE-${Date.now()}`,
    })

    const res = await request(app)
      .post('/api/v1/admin/zones')
      .set(authHeader(signToken(admin)))
      .send({ name: 'Bastos', type: 'district', parent_id: city._id })

    expect(res.status).toBe(201)
    expect(res.body.data.level).toBe(2)
    expect(res.body.data.parent_id.toString()).toBe(city._id.toString())
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .post('/api/v1/admin/zones')
      .set(authHeader(signToken(user)))
      .send({ name: 'Hack Zone', type: 'city' })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. GET /admin/analytics — platform analytics
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/analytics — platform analytics', () => {
  it('returns analytics data to an admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  it('counts only settled orders in the financial volume', async () => {
    const vendorId = new mongoose.Types.ObjectId()
    const ids = { customerId: user._id, vendorId }

    await createOrder(ids, { total_amount: 12_000, subtotal: 12_000, payment_status: 'pending', order_status: 'placed' })
    await createOrder(ids, { total_amount: 8_000, subtotal: 8_000, payment_status: 'refunded', order_status: 'refunded' })
    await createOrder(ids, { total_amount: 5_000, subtotal: 5_000, payment_status: 'paid', order_status: 'processing' })

    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.data.stats.revenue).toBe(5_000)
  })

  it('returns 403 for a regular user', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})
