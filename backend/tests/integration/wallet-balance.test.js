'use strict'
/**
 * tests/integration/wallet-balance.test.js
 * Money-moving responses carry the committed balance, so every balance on
 * screen (top nav included) can update immediately without a second request.
 */

const request = require('supertest')

const { buildApp }      = require('../setup/app')
const { createUser }    = require('../factories')
const { asUser }        = require('../helpers/auth')
const PlatformSettings  = require('../../models/PlatformSettings.model')
const WithdrawalRequest = require('../../models/WithdrawalRequest.model')
const Transaction       = require('../../models/Transaction.model')

let app
beforeAll(async () => {
  app = buildApp()
  // Create collections up front: creating one inside a multi-document
  // transaction on a fresh test database raises a transient WriteConflict.
  await Promise.all([WithdrawalRequest.init(), Transaction.init()])
  await Promise.all([WithdrawalRequest.createCollection(), Transaction.createCollection()])
})

beforeEach(async () => {
  await PlatformSettings.create({
    commission_rate: 0,
    commission_type: 'percentage',
    escrow_fee_type: 'percentage',
    escrow_fee_value: 0,
    min_withdrawal_amount: 500,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  })
})

describe('Legacy POST /wallet/withdraw', () => {
  it('moves no money: withdrawals must go through the admin-reviewed /withdrawals queue', async () => {
    const user = await createUser({ wallet_balance: 10_000 })
    const res = await request(app)
      .post('/api/v1/wallet/withdraw')
      .set(asUser(user))
      .send({ amount: 2_000, method: 'mtn', details: { account_number: '+237651000001' } })

    expect(res.status).toBe(410)
    const wallet = await request(app).get('/api/v1/wallet').set(asUser(user)).expect(200)
    expect(wallet.body.data.balance).toBe(10_000)
  })
})

describe('Withdrawal request response', () => {
  it('returns the committed post-debit balance', async () => {
    const user = await createUser({ wallet_balance: 10_000 })
    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(asUser(user))
      .send({
        amount: 2_000,
        currency: 'XAF',
        withdrawal_method: 'momo',
        recipient_details: { phone_number: '+237651000001', first_name: 'Jean', last_name: 'Dupont', country: 'CM' },
      })

    expect(res.status).toBe(201)
    expect(res.body.data.balance).toBe(8_000)

    const wallet = await request(app).get('/api/v1/wallet').set(asUser(user)).expect(200)
    expect(wallet.body.data.balance).toBe(8_000)
  })
})

describe('GET /wallet — lifetime totals', () => {
  it('earned = completed payouts + escrow releases (all time); withdrawn = completed withdrawals', async () => {
    const user = await createUser({ wallet_balance: 0 })
    const tx = (type, amount, status = 'completed') => ({
      user_id: user._id, type, amount, status, gateway: 'platform',
      reference: `T-${type}-${amount}-${Math.random().toString(36).slice(2, 8)}`, description: type,
    })
    // 60 payouts — more than any page of history — must all count.
    await Transaction.insertMany(Array.from({ length: 60 }, () => tx('payout', 1_000)))
    await Transaction.insertMany([
      tx('escrow_release', 5_000),
      tx('payout', 9_999, 'pending'),     // held, not earned yet
      tx('refund', 4_000),                // money back on a purchase — not earnings
      tx('deposit', 50_000),              // top-up — not earnings
    ])
    const wr = (status, amount) => ({
      requested_by: user._id, role: 'user', amount, currency: 'XAF', status, withdrawal_method: 'momo',
      recipient_details: { phone_number: '+237651000001', first_name: 'Ada', last_name: 'N', country: 'CM' },
    })
    await WithdrawalRequest.insertMany([wr('completed', 7_000), wr('pending', 3_000), wr('rejected', 2_000)])

    const res = await request(app).get('/api/v1/wallet').set(asUser(user))

    expect(res.status).toBe(200)
    expect(res.body.data.totals).toEqual({ earned: 65_000, withdrawn: 7_000 })
  })
})
