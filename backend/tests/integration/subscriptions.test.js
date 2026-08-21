'use strict'
/**
 * tests/integration/subscriptions.test.js
 * Prompt 7 — Subscription flows: status, wallet activation, admin plan CRUD.
 *
 * Sections:
 *   1. GET  /subscriptions/me               — status for auth user
 *   2. POST /subscriptions/initialize       — wallet activation + guards
 *   3. POST /admin/plans                    — admin plan create + 403 guard
 *   4. PATCH /admin/plans/:id               — update + 404
 *   5. DELETE /admin/plans/:id              — delete + 404
 *   6. POST /admin/subscriptions/activate   — activate user subscription
 *   7. PATCH /admin/subscriptions/:id       — status actions
 *   8. GET  /admin/overview                 — stats + 403 guard
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }                  = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin }               = require('../factories')
const { signToken, authHeader }     = require('../helpers/auth')

const User             = require('../../models/User.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const SubscriptionPlan = require('../../models/SubscriptionPlan.model')
const UserSubscription = require('../../models/UserSubscription.model')
const Transaction      = require('../../models/Transaction.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let vendorUser, customer

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])

  vendorUser = await createVendorUser({ wallet_balance: 20_000 })
  customer   = await createUser()
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper — create a simple vendor-targeted plan
// ─────────────────────────────────────────────────────────────────────────────
const makePlan = (overrides = {}) =>
  SubscriptionPlan.create({
    name:             'Test Vendor Plan',
    slug:             `tvp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    price:            5_000,
    roles:            ['vendor'],
    is_active:        true,
    contact_required: false,
    ...overrides,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /subscriptions/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /subscriptions/me', () => {
  it('returns subscription status for an authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/me')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // When subscription is not required, active = true
    expect(res.body.data.active).toBe(true)
    expect(res.body.data.required).toBe(false)
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/subscriptions/me')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /subscriptions/initialize — wallet payment path
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /subscriptions/initialize — wallet path', () => {
  it('activates subscription, debits wallet, and creates a transaction', async () => {
    const plan = await makePlan({ price: 3_000 })

    const before = await User.findById(vendorUser._id)

    const res = await request(app)
      .post('/api/v1/subscriptions/initialize')
      .set(authHeader(signToken(vendorUser)))
      .send({ plan_id: plan._id, payment_method: 'wallet' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.subscription).toBeDefined()
    expect(res.body.data.subscription.status).toBe('active')

    // Wallet debited
    const after = await User.findById(vendorUser._id)
    expect(after.wallet_balance).toBe(before.wallet_balance - 3_000)

    // Transaction created
    const tx = await Transaction.findOne({ user_id: vendorUser._id, type: 'subscription' })
    expect(tx).toBeTruthy()
    expect(tx.status).toBe('completed')
    expect(tx.gateway).toBe('wallet')
  })

  it('returns 400 when wallet balance is insufficient', async () => {
    const plan = await makePlan({ price: 50_000 })
    // vendorUser starts with 20_000 wallet balance

    const res = await request(app)
      .post('/api/v1/subscriptions/initialize')
      .set(authHeader(signToken(vendorUser)))
      .send({ plan_id: plan._id, payment_method: 'wallet' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/insufficient/i)
  })

  it('returns 400 when role is admin', async () => {
    const admin = await createAdmin()
    const plan  = await makePlan()

    const res = await request(app)
      .post('/api/v1/subscriptions/initialize')
      .set(authHeader(signToken(admin)))
      .send({ plan_id: plan._id, role: 'admin', payment_method: 'wallet' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/admin/i)
  })

  it('returns 200 with existing plan message when same plan is already active', async () => {
    const plan = await makePlan({ price: 1_000 })

    // First activation
    await request(app)
      .post('/api/v1/subscriptions/initialize')
      .set(authHeader(signToken(vendorUser)))
      .send({ plan_id: plan._id, payment_method: 'wallet' })

    // Second attempt for the same plan
    const res = await request(app)
      .post('/api/v1/subscriptions/initialize')
      .set(authHeader(signToken(vendorUser)))
      .send({ plan_id: plan._id, payment_method: 'wallet' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/already active/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /subscriptions/admin/plans — create plan
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /subscriptions/admin/plans', () => {
  it('creates a new subscription plan (admin only, 201)', async () => {
    const admin = await createAdmin()

    const res = await request(app)
      .post('/api/v1/subscriptions/admin/plans')
      .set(authHeader(signToken(admin)))
      .send({
        name:          'Premium Vendor Plan',
        price:         10_000,
        roles:         ['vendor'],
        billing_cycle: 'monthly',
        is_active:     true,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.plan.name).toBe('Premium Vendor Plan')
    expect(res.body.data.plan.price).toBe(10_000)
  })

  it('blocks non-admin with 403', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/admin/plans')
      .set(authHeader(signToken(customer)))
      .send({ name: 'Sneaky Plan', price: 0 })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /subscriptions/admin/plans/:id — update plan
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /subscriptions/admin/plans/:id', () => {
  it('updates an existing plan', async () => {
    const admin = await createAdmin()
    const plan  = await makePlan({ name: 'Old Name' })

    const res = await request(app)
      .patch(`/api/v1/subscriptions/admin/plans/${plan._id}`)
      .set(authHeader(signToken(admin)))
      .send({ name: 'Updated Name', price: 8_000 })

    expect(res.status).toBe(200)
    expect(res.body.data.plan.name).toBe('Updated Name')
    expect(res.body.data.plan.price).toBe(8_000)
  })

  it('returns 404 for a non-existent plan', async () => {
    const admin = await createAdmin()

    const res = await request(app)
      .patch(`/api/v1/subscriptions/admin/plans/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(signToken(admin)))
      .send({ name: 'Ghost' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /subscriptions/admin/plans/:id — delete plan
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /subscriptions/admin/plans/:id', () => {
  it('deletes an existing plan and returns 200', async () => {
    const admin = await createAdmin()
    const plan  = await makePlan()

    const res = await request(app)
      .delete(`/api/v1/subscriptions/admin/plans/${plan._id}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const gone = await SubscriptionPlan.findById(plan._id)
    expect(gone).toBeNull()
  })

  it('returns 404 for a non-existent plan', async () => {
    const admin = await createAdmin()

    const res = await request(app)
      .delete(`/api/v1/subscriptions/admin/plans/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /subscriptions/admin/subscriptions/activate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /subscriptions/admin/subscriptions/activate', () => {
  it('activates a subscription for a user by their ID', async () => {
    const admin  = await createAdmin()
    const plan   = await makePlan()
    const target = await createVendorUser()

    const res = await request(app)
      .post('/api/v1/subscriptions/admin/subscriptions/activate')
      .set(authHeader(signToken(admin)))
      .send({
        user_id: target._id,
        plan_id: plan._id,
        role:    'vendor',
        note:    'Test activation.',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.subscription.status).toBe('active')
    expect(res.body.data.subscription.user_id.toString()).toBe(target._id.toString())
  })

  it('returns 404 for unknown user', async () => {
    const admin = await createAdmin()
    const plan  = await makePlan()

    const res = await request(app)
      .post('/api/v1/subscriptions/admin/subscriptions/activate')
      .set(authHeader(signToken(admin)))
      .send({ user_id: new mongoose.Types.ObjectId(), plan_id: plan._id })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. PATCH /subscriptions/admin/subscriptions/:id — status actions
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /subscriptions/admin/subscriptions/:id', () => {
  it('cancels an active subscription', async () => {
    const admin = await createAdmin()
    const sub   = await UserSubscription.create({
      user_id:    vendorUser._id,
      plan_id:    new mongoose.Types.ObjectId(),
      role:       'vendor',
      status:     'active',
      started_at: new Date(),
      history:    [],
    })

    const res = await request(app)
      .patch(`/api/v1/subscriptions/admin/subscriptions/${sub._id}`)
      .set(authHeader(signToken(admin)))
      .send({ action: 'cancel', note: 'Test cancellation.' })

    expect(res.status).toBe(200)
    expect(res.body.data.subscription.status).toBe('cancelled')
  })

  it('rejects an invalid action with 400', async () => {
    const admin = await createAdmin()
    const sub   = await UserSubscription.create({
      user_id:    vendorUser._id,
      plan_id:    new mongoose.Types.ObjectId(),
      role:       'vendor',
      status:     'active',
      started_at: new Date(),
      history:    [],
    })

    const res = await request(app)
      .patch(`/api/v1/subscriptions/admin/subscriptions/${sub._id}`)
      .set(authHeader(signToken(admin)))
      .send({ action: 'suspend' }) // not a valid action

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cancel|refund|activate/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. GET /subscriptions/admin/overview
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /subscriptions/admin/overview', () => {
  it('returns plans, subscriptions, and stats for admin', async () => {
    const admin = await createAdmin()
    await makePlan()

    const res = await request(app)
      .get('/api/v1/subscriptions/admin/overview')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.plans)).toBe(true)
    expect(res.body.data.stats).toBeDefined()
    expect(typeof res.body.data.stats.revenue).toBe('number')
  })

  it('blocks non-admin with 403', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/admin/overview')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})
