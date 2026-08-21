'use strict'
/**
 * tests/integration/wallet.test.js
 * Prompt 5 — Wallet endpoints: balance, withdraw, transaction history, admin tools.
 *
 * Sections:
 *   1. GET  /wallet              — balance (customer + vendor pending_escrow)
 *   2. POST /wallet/withdraw     — happy path + guard rails
 *   3. GET  /wallet/transactions — history scoped to authenticated user
 *   4. GET  /wallet/admin/stats  — admin financial snapshot; non-admin → 403
 *   5. GET  /wallet/admin/withdrawals — admin lists withdrawals; non-admin → 403
 *   6. PATCH /wallet/admin/withdrawals/:id — reject restores balance; non-admin → 403
 */

const request    = require('supertest')
const mongoose   = require('mongoose')
const { faker }  = require('@faker-js/faker')

const { buildApp }                                      = require('../setup/app')
const { createUser, createVendorUser, createAdmin,
        createTransaction }                             = require('../factories')
const { signToken, authHeader }                         = require('../helpers/auth')

const User             = require('../../models/User.model')
const Transaction      = require('../../models/Transaction.model')
const Vendor           = require('../../models/Vendor.model')
const Escrow           = require('../../models/Escrow.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

// ─────────────────────────────────────────────────────────────────────────────
// Shared app instance — built once, reused across all tests
// ─────────────────────────────────────────────────────────────────────────────
let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /wallet — balance
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /wallet — balance', () => {
  it('returns wallet balance for a customer', async () => {
    const user = await createUser({ wallet_balance: 25_000 })

    const res = await request(app)
      .get('/api/v1/wallet')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.balance).toBe(25_000)
    expect(res.body.data.pending_escrow).toBe(0)
  })

  it('sums held escrow amounts in pending_escrow for a vendor', async () => {
    const vendorUser = await createVendorUser({ wallet_balance: 10_000 })
    const vendorDoc  = await Vendor.create({
      user_id:       vendorUser._id,
      store_name:    faker.company.name().slice(0, 100),
      description:   faker.lorem.sentence(),
      phone:         faker.phone.number(),
      verified:      true,
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    // Insert raw escrow records to bypass model validation quirks
    const dummyBuyerId = new mongoose.Types.ObjectId()
    await Escrow.collection.insertMany([
      {
        order_id:  new mongoose.Types.ObjectId(),
        buyer_id:  dummyBuyerId,
        vendor_id: vendorDoc._id,
        amount:    8_000,
        status:    'held',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        order_id:  new mongoose.Types.ObjectId(),
        buyer_id:  dummyBuyerId,
        vendor_id: vendorDoc._id,
        amount:    4_500,
        status:    'held',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        // 'released' records must NOT be counted
        order_id:  new mongoose.Types.ObjectId(),
        buyer_id:  dummyBuyerId,
        vendor_id: vendorDoc._id,
        amount:    2_000,
        status:    'released',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await request(app)
      .get('/api/v1/wallet')
      .set(authHeader(signToken(vendorUser)))

    expect(res.status).toBe(200)
    expect(res.body.data.pending_escrow).toBe(12_500) // 8000 + 4500; 2000 excluded
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/wallet')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /wallet/withdraw — withdrawal requests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /wallet/withdraw — happy path', () => {
  it('deducts balance and creates a pending withdrawal transaction', async () => {
    const user = await createUser({ wallet_balance: 20_000 })

    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 5_000, method: 'mtn', details: { account_number: '677000001' } })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.remaining_balance).toBe(15_000)

    // Withdrawal transaction persisted
    const txn = await Transaction.findOne({ user_id: user._id, type: 'withdrawal' })
    expect(txn).not.toBeNull()
    expect(txn.amount).toBe(5_000)
    expect(txn.status).toBe('pending')

    // Wallet debited atomically
    const fresh = await User.findById(user._id)
    expect(fresh.wallet_balance).toBe(15_000)
  })
})

describe('POST /wallet/withdraw — guard rails', () => {
  it('rejects amount below 500 XAF', async () => {
    const user = await createUser({ wallet_balance: 10_000 })

    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 200, method: 'mtn', details: { account_number: '677000001' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/500/)
  })

  it('rejects when wallet balance is insufficient', async () => {
    const user = await createUser({ wallet_balance: 300 })

    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 1_000, method: 'orange', details: { account_number: '699000002' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Insufficient/i)
  })

  it('rejects an unsupported withdrawal method', async () => {
    const user = await createUser({ wallet_balance: 10_000 })

    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 1_000, method: 'paypal', details: { account_number: '677000001' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Invalid withdrawal method/i)
  })

  it('rejects when account_number is missing from details', async () => {
    const user = await createUser({ wallet_balance: 10_000 })

    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 1_000, method: 'mtn', details: {} })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Phone number is required/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /wallet/transactions — history
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /wallet/transactions — history', () => {
  it("returns only the authenticated user's transactions", async () => {
    const userA = await createUser()
    const userB = await createUser()

    // Two transactions for A, one for B
    await createTransaction(userA._id, { type: 'deposit', status: 'completed',
      description: 'Deposit A1' })
    await createTransaction(userA._id, { type: 'deposit', status: 'completed',
      description: 'Deposit A2' })
    await createTransaction(userB._id, { type: 'deposit', status: 'completed',
      description: 'Deposit B1' })

    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set(authHeader(signToken(userA)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.transactions).toHaveLength(2)
    for (const txn of res.body.data.transactions) {
      expect(txn.user_id).toBe(userA._id.toString())
    }
  })

  it('returns an empty array when the user has no transactions', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/wallet/transactions')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.data.transactions).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /wallet/admin/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /wallet/admin/stats', () => {
  it('returns financial snapshot for admin', async () => {
    await PlatformSettings.create([{
      commission_rate: 10,
      commission_type: 'percentage',
    }])
    const admin = await createAdmin()

    const res = await request(app)
      .get('/api/v1/wallet/admin/stats')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('total_escrow_held')
    expect(res.body.data).toHaveProperty('total_pending_withdrawals')
    expect(res.body.data).toHaveProperty('commission_rate')
  })

  it('blocks non-admin users with 403', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/wallet/admin/stats')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /wallet/admin/withdrawals
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /wallet/admin/withdrawals', () => {
  it('lists all withdrawal-type transactions for admin', async () => {
    const admin = await createAdmin()
    const user  = await createUser({ wallet_balance: 50_000 })

    await createTransaction(user._id, { type: 'withdrawal', status: 'pending',
      description: 'Withdrawal to MTN MoMo (677000001)' })
    await createTransaction(user._id, { type: 'withdrawal', status: 'pending',
      description: 'Withdrawal to Orange Money (699000002)' })
    await createTransaction(user._id, { type: 'deposit', status: 'completed',
      description: 'Deposit — should not appear' })

    const res = await request(app)
      .get('/api/v1/wallet/admin/withdrawals')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Every returned record must be a withdrawal
    for (const w of res.body.data.withdrawals) {
      expect(w.type).toBe('withdrawal')
    }
    expect(res.body.data.withdrawals.length).toBeGreaterThanOrEqual(2)
  })

  it('blocks non-admin with 403', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/wallet/admin/withdrawals')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PATCH /wallet/admin/withdrawals/:id — process withdrawal
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /wallet/admin/withdrawals/:id', () => {
  it('rejecting a withdrawal refunds the full amount to the user', async () => {
    const admin = await createAdmin()
    const user  = await createUser({ wallet_balance: 20_000 })

    // Submit withdrawal: balance 20 000 → 15 000
    const withdrawRes = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(authHeader(signToken(user)))
      .send({ amount: 5_000, method: 'mtn', details: { account_number: '677000001' } })

    expect(withdrawRes.status).toBe(201)
    const txnId = withdrawRes.body.data.transaction._id

    // Admin rejects: balance 15 000 → 20 000
    const rejectRes = await request(app)
      .patch(`/api/v1/wallet/admin/withdrawals/${txnId}`)
      .set(authHeader(signToken(admin)))
      .send({ action: 'reject' })

    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.success).toBe(true)

    const fresh = await User.findById(user._id)
    expect(fresh.wallet_balance).toBe(20_000)

    const txn = await Transaction.findById(txnId)
    expect(txn.status).toBe('rejected')
  })

  it('rejects processing a transaction that is already finalized', async () => {
    const admin = await createAdmin()
    const user  = await createUser()

    // Create a completed withdrawal directly — simulates already-approved
    const txn = await createTransaction(user._id, {
      type:             'withdrawal',
      status:           'completed',
      description:      'Withdrawal to MTN MoMo (677000001)',
      gateway_response: { method: 'mtn', details: { account_number: '677000001' } },
    })

    const res = await request(app)
      .patch(`/api/v1/wallet/admin/withdrawals/${txn._id}`)
      .set(authHeader(signToken(admin)))
      .send({ action: 'reject' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already processed/i)
  })

  it('rejects an invalid action value', async () => {
    const admin = await createAdmin()
    const user  = await createUser({ wallet_balance: 5_000 })

    const txn = await createTransaction(user._id, {
      type:             'withdrawal',
      status:           'pending',
      description:      'Withdrawal to Orange Money (699000001)',
      gateway_response: { method: 'orange', details: { account_number: '699000001' } },
    })

    const res = await request(app)
      .patch(`/api/v1/wallet/admin/withdrawals/${txn._id}`)
      .set(authHeader(signToken(admin)))
      .send({ action: 'delete' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Invalid action/i)
  })

  it('blocks non-admin with 403', async () => {
    const user = await createUser({ wallet_balance: 5_000 })
    const txn  = await createTransaction(user._id, {
      type:        'withdrawal',
      status:      'pending',
      description: 'Withdrawal to MTN MoMo (677000001)',
    })

    const res = await request(app)
      .patch(`/api/v1/wallet/admin/withdrawals/${txn._id}`)
      .set(authHeader(signToken(user)))
      .send({ action: 'reject' })

    expect(res.status).toBe(403)
  })
})
