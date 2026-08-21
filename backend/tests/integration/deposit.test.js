'use strict'
/**
 * tests/integration/deposit.test.js
 * Prompt 21 — POST /wallet/deposit — wallet top-up initiation.
 *
 * wallet.controller.js:initiateDeposit is gateway-agnostic (manual gateway,
 * no external HTTP calls). Tests are fully self-contained.
 *
 * Sections:
 *   1. Happy path — creates a pending transaction and returns reference
 *   2. Guard rails — invalid amount, unauthenticated
 */

const request    = require('supertest')

const { buildApp }              = require('../setup/app')
const { createUser, createVendorUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Transaction = require('../../models/Transaction.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// POST /wallet/deposit
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /wallet/deposit — initiate a wallet top-up', () => {
  it('creates a pending Transaction and returns a reference', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .set(authHeader(signToken(user)))
      .send({ amount: 10_000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('transaction')
    expect(res.body.data.transaction).toHaveProperty('reference')
    expect(res.body.data.transaction.status).toBe('pending')
    expect(res.body.data.transaction.type).toBe('deposit')
    expect(res.body.data.transaction.amount).toBe(10_000)

    // Verify the DB record was created
    const tx = await Transaction.findOne({ user_id: user._id, type: 'deposit' }).lean()
    expect(tx).not.toBeNull()
    expect(tx.status).toBe('pending')
  })

  it('works for a vendor account too', async () => {
    const vendor = await createVendorUser()

    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .set(authHeader(signToken(vendor)))
      .send({ amount: 5_000 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects amount of 0 with 400', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .set(authHeader(signToken(user)))
      .send({ amount: 0 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects negative amount with 400', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .set(authHeader(signToken(user)))
      .send({ amount: -500 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects missing amount with 400', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .set(authHeader(signToken(user)))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('requires authentication — 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/deposit')
      .send({ amount: 5_000 })

    expect(res.status).toBe(401)
  })
})
