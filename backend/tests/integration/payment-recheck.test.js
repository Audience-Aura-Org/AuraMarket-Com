'use strict'
/**
 * tests/integration/payment-recheck.test.js
 * GET /payments/:gateway/recheck/:reference — the wallet pages' "Recheck payment".
 *
 * The outcome of the payment is data, not an HTTP error: a declined payment is
 * a successful recheck (200, status FAILED). Returning 4xx made axios throw, so
 * the wallet row stayed "pending" with a "Recheck payment" button forever.
 */

const request = require('supertest')

const { buildApp }   = require('../setup/app')
const { createUser } = require('../factories')
const { asUser }     = require('../helpers/auth')
const Transaction    = require('../../models/Transaction.model')
const User           = require('../../models/User.model')
const pawapay        = require('../../services/payment/gateways/pawapay.gateway')

let app
beforeAll(() => { app = buildApp() })
afterEach(() => vi.restoreAllMocks())

const seedDeposit = (user, overrides = {}) => Transaction.create({
  user_id: user._id, type: 'deposit', amount: 5_000, status: 'pending', gateway: 'pawapay',
  reference: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  gateway_transaction_id: `pp-${Date.now()}`, description: 'Wallet top-up', ...overrides,
})

describe('GET /payments/pawapay/recheck/:reference', () => {
  it('a declined payment returns 200 with status FAILED and marks the transaction failed', async () => {
    const user = await createUser({ wallet_balance: 0 })
    const tx = await seedDeposit(user)
    vi.spyOn(pawapay, 'getDepositStatus').mockResolvedValue({
      status: 'FAILED', rejectionReason: { rejectionMessage: 'Insufficient balance on mobile money account' },
    })

    const res = await request(app).get(`/api/v1/payments/pawapay/recheck/${tx.reference}`).set(asUser(user))

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('FAILED')
    expect(res.body.reason).toMatch(/insufficient balance/i)
    expect((await Transaction.findById(tx._id)).status).toBe('failed')
  })

  it('a confirmed payment returns SUCCESSFUL and credits the wallet', async () => {
    const user = await createUser({ wallet_balance: 0 })
    const tx = await seedDeposit(user)
    vi.spyOn(pawapay, 'getDepositStatus').mockResolvedValue({ status: 'COMPLETED' })

    const res = await request(app).get(`/api/v1/payments/pawapay/recheck/${tx.reference}`).set(asUser(user))

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('SUCCESSFUL')
    expect((await User.findById(user._id)).wallet_balance).toBe(5_000)
  })

  it('an unreachable gateway reports PENDING (never FAILED)', async () => {
    const user = await createUser()
    const tx = await seedDeposit(user)
    vi.spyOn(pawapay, 'getDepositStatus').mockRejectedValue(new Error('ETIMEDOUT'))

    const res = await request(app).get(`/api/v1/payments/pawapay/recheck/${tx.reference}`).set(asUser(user))

    expect(res.body.status).toBe('PENDING')
    expect((await Transaction.findById(tx._id)).status).toBe('pending')
  })

  it("another user cannot recheck (or learn about) someone else's transaction", async () => {
    const owner = await createUser()
    const stranger = await createUser()
    const tx = await seedDeposit(owner)
    const spy = vi.spyOn(pawapay, 'getDepositStatus').mockResolvedValue({ status: 'COMPLETED' })

    const res = await request(app).get(`/api/v1/payments/pawapay/recheck/${tx.reference}`).set(asUser(stranger))

    expect(res.status).toBe(404)
    expect(spy).not.toHaveBeenCalled()
  })
})
