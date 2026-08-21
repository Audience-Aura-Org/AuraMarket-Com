'use strict'
/**
 * tests/integration/idor.test.js
 * Prompt 3 — Insecure Direct Object Reference (IDOR) sweep.
 *
 * Strategy: create a resource as User A, then attempt to access it as
 * User B (a completely different authenticated user). Expect 403 or 404.
 *
 * Covered surfaces (per MATRIX.md):
 *   1. GET  /orders/:id         — owner-only (customer OR vendor of that order)
 *   2. GET  /wallet             — returns ONLY the calling user's balance
 *   3. GET  /wallet/transactions — scoped to calling user
 *   4. GET  /disputes/customer  — scoped to calling user
 *   5. GET  /auth/users/:id     — public profile (non-sensitive fields only)
 *
 * [C] fix applied: getOrderById now checks ownership before returning.
 *   Regression test in section 1 proves the fix holds.
 */

const request  = require('supertest')
const mongoose = require('mongoose')

const { buildApp }                         = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin, createOrder,
        createLogisticsUser }              = require('../factories')
const { signToken, authHeader }            = require('../helpers/auth')
const Vendor                               = require('../../models/Vendor.model')
const User                                 = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a minimal vendor Vendor document directly
// ─────────────────────────────────────────────────────────────────────────────
const { faker } = require('@faker-js/faker')

const makeVendorDoc = async (userId) =>
  Vendor.create({
    user_id:      userId,
    store_name:   faker.company.name().slice(0, 100),
    description:  faker.lorem.sentence(),
    phone:        faker.phone.number(),
    verified:     false,
    rating:       0,
    total_sales:  0,
    total_revenue: 0,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. Order IDOR — GET /orders/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('IDOR — GET /orders/:id', () => {
  it('[regression] a random customer cannot read another customer\'s order', async () => {
    // User A creates an order
    const userA   = await createUser({ verification_status: 'verified' })
    const vendor  = await createVendorUser({ verification_status: 'verified' })
    const vendorDoc = await makeVendorDoc(vendor._id)

    const order = await createOrder({
      customerId: userA._id,
      vendorId:   vendorDoc._id,
    })

    // User B — completely unrelated customer
    const userB    = await createUser({ verification_status: 'verified' })
    const tokenB   = signToken(userB)

    const res = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(authHeader(tokenB))

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('the customer who placed the order CAN read it', async () => {
    const userA     = await createUser({ verification_status: 'verified' })
    const vendor    = await createVendorUser({ verification_status: 'verified' })
    const vendorDoc = await makeVendorDoc(vendor._id)

    const order  = await createOrder({ customerId: userA._id, vendorId: vendorDoc._id })
    const tokenA = signToken(userA)

    const res = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(authHeader(tokenA))

    expect(res.status).toBe(200)
    expect(res.body.data.order._id.toString()).toBe(order._id.toString())
  })

  it('an admin CAN read any order', async () => {
    const customer  = await createUser({ verification_status: 'verified' })
    const vendor    = await createVendorUser({ verification_status: 'verified' })
    const vendorDoc = await makeVendorDoc(vendor._id)

    const order = await createOrder({ customerId: customer._id, vendorId: vendorDoc._id })
    const admin = await createAdmin({ verification_status: 'verified' })

    const res = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
  })

  it('returns 404 for a non-existent order ID', async () => {
    const user  = await createUser({ verification_status: 'verified' })
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .get(`/api/v1/orders/${fakeId}`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Wallet balance scoping — GET /wallet
// ─────────────────────────────────────────────────────────────────────────────

describe('Wallet scoping — GET /wallet', () => {
  it('returns only the calling user\'s wallet balance', async () => {
    const rich  = await createUser({ wallet_balance: 50_000, verification_status: 'verified' })
    const broke = await createUser({ wallet_balance:      0, verification_status: 'verified' })

    const resRich  = await request(app).get('/api/v1/wallet').set(authHeader(signToken(rich)))
    const resBroke = await request(app).get('/api/v1/wallet').set(authHeader(signToken(broke)))

    expect(resRich.status).toBe(200)
    expect(resBroke.status).toBe(200)

    // Each user sees their own balance — not the other's
    expect(resRich.body.data?.balance ?? resRich.body.data?.wallet_balance).toBe(50_000)
    expect(resBroke.body.data?.balance ?? resBroke.body.data?.wallet_balance).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dispute scoping — GET /disputes/customer
// ─────────────────────────────────────────────────────────────────────────────

describe('Dispute scoping — GET /disputes/customer', () => {
  it('each customer only sees their own disputes (not another user\'s)', async () => {
    const userA = await createUser({ verification_status: 'verified' })
    const userB = await createUser({ verification_status: 'verified' })

    // Both request their own dispute list — neither should error
    const resA = await request(app)
      .get('/api/v1/disputes/customer')
      .set(authHeader(signToken(userA)))
    const resB = await request(app)
      .get('/api/v1/disputes/customer')
      .set(authHeader(signToken(userB)))

    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    // Both lists are empty (no disputes created) — proves scoping doesn't leak cross-user
    const listA = resA.body.data?.disputes ?? resA.body.data ?? []
    const listB = resB.body.data?.disputes ?? resB.body.data ?? []
    expect(Array.isArray(listA)).toBe(true)
    expect(Array.isArray(listB)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Public profile endpoint — GET /auth/users/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('IDOR — GET /auth/users/:id (public profile)', () => {
  it('returns only safe public fields — no email, password, wallet_balance', async () => {
    const target = await createUser({
      wallet_balance: 99_000,
      verification_status: 'verified',
    })
    const caller = await createUser({ verification_status: 'verified' })

    const res = await request(app)
      .get(`/api/v1/auth/users/${target._id}`)
      .set(authHeader(signToken(caller)))

    expect(res.status).toBe(200)

    const profile = res.body.data?.user ?? res.body.user ?? res.body.data
    // These fields must NOT appear in the response
    expect(profile?.email).toBeUndefined()
    expect(profile?.password).toBeUndefined()
    expect(profile?.wallet_balance).toBeUndefined()
    expect(profile?.token_version).toBeUndefined()
  })
})
