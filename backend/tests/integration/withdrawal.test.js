'use strict'
/**
 * tests/integration/withdrawal.test.js
 * Prompt 10 — Withdrawal flows: submit, list, admin approve/reject.
 *
 * Sections:
 *   1. POST /withdrawals              — submit a withdrawal request
 *   2. GET  /withdrawals/mine         — list own withdrawals
 *   3. GET  /withdrawals/admin        — admin view of all withdrawals
 *   4. POST /withdrawals/admin/:id/reject — admin rejects + balance restored
 */

const request   = require('supertest')
const mongoose  = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp }          = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { signToken, authHeader }   = require('../helpers/auth')

const User                = require('../../models/User.model')
const WithdrawalRequest   = require('../../models/WithdrawalRequest.model')
const PlatformSettings    = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let user, admin

beforeEach(async () => {
  user  = await createUser()
  admin = await createAdmin()

  // Ensure PlatformSettings exist (min_withdrawal_amount defaults to 500 if absent,
  // but getSettings() may need at least one document)
  await PlatformSettings.create({
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    min_withdrawal_amount: 500,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Give a user enough wallet balance to withdraw. */
const fundWallet = (userId, amount) =>
  User.findByIdAndUpdate(userId, { wallet_balance: amount })

/** Valid MoMo withdrawal payload. */
const momoPayload = (amount = 2_000) => ({
  amount,
  currency:          'XAF',
  withdrawal_method: 'momo',
  recipient_details: {
    phone_number: '+237651000001',
    first_name:   'Jean',
    last_name:    'Dupont',
    country:      'CM',
  },
})

/** Seed a pending WithdrawalRequest directly in DB (bypasses payout gateway). */
const seedPendingWithdrawal = (userId, amount = 3_000) =>
  WithdrawalRequest.create({
    requested_by:      userId,
    role:              'user',
    amount,
    currency:          'XAF',
    withdrawal_method: 'momo',
    recipient_details: {
      phone_number: '+237651000001',
      first_name:   'Jean',
      last_name:    'Dupont',
      country:      'CM',
    },
    status:           'pending',
    balance_deducted: true,
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /withdrawals — submit
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /withdrawals — submit a withdrawal request', () => {
  it('creates a pending withdrawal and returns 201 when the wallet has sufficient funds', async () => {
    await fundWallet(user._id, 10_000)

    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(authHeader(signToken(user)))
      .send(momoPayload(2_000))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.withdrawal.status).toBe('pending')
    expect(res.body.data.withdrawal.amount).toBe(2_000)

    // Wallet should be debited immediately
    const updated = await User.findById(user._id)
    expect(updated.wallet_balance).toBe(8_000)
  })

  it('returns 400 when the amount is below the minimum withdrawal limit', async () => {
    await fundWallet(user._id, 10_000)

    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(authHeader(signToken(user)))
      .send(momoPayload(100))  // below 500 minimum

    expect(res.status).toBe(400)
  })

  it('returns 400 when wallet balance is insufficient', async () => {
    await fundWallet(user._id, 500)

    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(authHeader(signToken(user)))
      .send(momoPayload(5_000))

    expect(res.status).toBe(400)
  })

  it('returns 400 when withdrawal_method is invalid', async () => {
    await fundWallet(user._id, 10_000)

    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(authHeader(signToken(user)))
      .send({ ...momoPayload(), withdrawal_method: 'bank_transfer' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when recipient phone_number is missing for momo', async () => {
    await fundWallet(user._id, 10_000)
    const payload = momoPayload()
    delete payload.recipient_details.phone_number

    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(authHeader(signToken(user)))
      .send(payload)

    expect(res.status).toBe(400)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/withdrawals')
      .send(momoPayload())

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /withdrawals/mine — own list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /withdrawals/mine — list own withdrawal requests', () => {
  it('returns own withdrawal requests and not others\'', async () => {
    const otherUser = await createUser()
    await seedPendingWithdrawal(user._id)
    await seedPendingWithdrawal(otherUser._id)

    const res = await request(app)
      .get('/api/v1/withdrawals/mine')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Only the requesting user's withdrawal should appear
    res.body.data.withdrawals.forEach(w => {
      expect(w.requested_by.toString()).toBe(user._id.toString())
    })
    expect(res.body.data.withdrawals).toHaveLength(1)
  })

  it('returns an empty list when the user has no withdrawals', async () => {
    const res = await request(app)
      .get('/api/v1/withdrawals/mine')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.data.withdrawals).toHaveLength(0)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/withdrawals/mine')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /withdrawals/admin — admin view
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /withdrawals/admin — admin view of all withdrawals', () => {
  it('returns all withdrawal requests to an admin', async () => {
    await seedPendingWithdrawal(user._id)

    const res = await request(app)
      .get('/api/v1/withdrawals/admin')
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.withdrawals.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 when a regular user calls the admin endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/withdrawals/admin')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /withdrawals/admin/:id/reject — admin reject + balance refund
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /withdrawals/admin/:id/reject — admin rejects withdrawal', () => {
  it('sets status to rejected and restores the user\'s wallet balance', async () => {
    const withdrawAmount = 3_000
    await fundWallet(user._id, withdrawAmount)
    const wr = await seedPendingWithdrawal(user._id, withdrawAmount)

    // Simulate the balance already having been deducted when the request was submitted
    await User.findByIdAndUpdate(user._id, { wallet_balance: 0 })

    const res = await request(app)
      .post(`/api/v1/withdrawals/admin/${wr._id}/reject`)
      .set(authHeader(signToken(admin)))
      .send({ rejection_reason: 'Invalid account details provided.' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.withdrawal.status).toBe('rejected')

    // Balance should be restored
    const updatedUser = await User.findById(user._id)
    expect(updatedUser.wallet_balance).toBe(withdrawAmount)
  })

  it('returns 400 when rejection_reason is missing or too short', async () => {
    const wr = await seedPendingWithdrawal(user._id)

    const res = await request(app)
      .post(`/api/v1/withdrawals/admin/${wr._id}/reject`)
      .set(authHeader(signToken(admin)))
      .send({ rejection_reason: 'No' })  // less than 5 chars

    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent withdrawal request', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .post(`/api/v1/withdrawals/admin/${fakeId}/reject`)
      .set(authHeader(signToken(admin)))
      .send({ rejection_reason: 'Does not exist.' })

    expect(res.status).toBe(404)
  })

  it('returns 403 when a non-admin user tries to reject', async () => {
    const wr = await seedPendingWithdrawal(user._id)

    const res = await request(app)
      .post(`/api/v1/withdrawals/admin/${wr._id}/reject`)
      .set(authHeader(signToken(user)))
      .send({ rejection_reason: 'Attempting unauthorized rejection.' })

    expect(res.status).toBe(403)
  })
})
