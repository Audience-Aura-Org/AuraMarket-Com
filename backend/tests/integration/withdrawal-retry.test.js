'use strict'
/**
 * tests/integration/withdrawal-retry.test.js
 * A withdrawal that hits a transient MongoDB transaction error
 * (TransientTransactionError / WriteConflict) is retried instead of
 * returning "Server error". A fresh database reproduces this reliably:
 * the first write creates the collection inside the transaction.
 * (Collections are deliberately NOT pre-created in this file.)
 */

const request = require('supertest')

const { buildApp }     = require('../setup/app')
const { createUser }   = require('../factories')
const { asUser }       = require('../helpers/auth')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

beforeEach(async () => {
  await PlatformSettings.create({
    commission_rate: 0, commission_type: 'percentage', escrow_fee_type: 'percentage', escrow_fee_value: 0,
    min_withdrawal_amount: 500, subscription_required_roles: { vendor: false, logistics: false, customer: false },
  })
})

describe('POST /withdrawals — transient transaction errors', () => {
  it('retries and succeeds instead of returning a server error', async () => {
    const user = await createUser({ wallet_balance: 10_000 })
    const res = await request(app)
      .post('/api/v1/withdrawals')
      .set(asUser(user))
      .send({
        amount: 2_000, currency: 'XAF', withdrawal_method: 'momo',
        recipient_details: { phone_number: '+237651000001', first_name: 'Jean', last_name: 'Dupont', country: 'CM' },
      })

    expect(res.status).toBe(201)
    expect(res.body.data.balance).toBe(8_000)
  })
})
