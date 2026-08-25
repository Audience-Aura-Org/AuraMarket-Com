'use strict'
/**
 * tests/integration/webhooks.test.js
 * Verifies security and idempotency of active payment gateway webhooks.
 *
 * Covers:
 *  - PayUnit   : HMAC-SHA256 signature rejection + acceptance
 *  - Eversend  : HMAC-SHA512 signature rejection + wallet-credit + idempotency
 *  - PawaPay   : Content-Digest rejection + wallet-credit + idempotency (deposit & checkout)
 */

const crypto        = require('crypto')
const request       = require('supertest')
const { buildApp }  = require('../setup/app')
const Transaction   = require('../../models/Transaction.model')
const User          = require('../../models/User.model')
const { createUser } = require('../factories/user.factory')
const {
  payunitWebhookPayload,  signPayunitWebhook,
  eversendWebhookPayload, signEversendWebhook,
  pawapayDepositWebhookPayload, pawapayCheckoutWebhookPayload, signPawapayWebhook,
} = require('../helpers/gateways')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// PAYUNIT
// ─────────────────────────────────────────────────────────────────────────────

describe('PayUnit webhook — security', () => {
  it('rejects a request with no signature header → 401', async () => {
    const payload = payunitWebhookPayload()
    await request(app)
      .post('/api/v1/payments/payunit/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('rejects a request with an incorrect signature → 401', async () => {
    const payload = payunitWebhookPayload()
    // Must be exactly 64 chars — same length as SHA-256 hex digest —
    // otherwise timingSafeEqual throws (buffers must have equal byte length)
    await request(app)
      .post('/api/v1/payments/payunit/webhook')
      .set('Content-Type', 'application/json')
      .set('x-payunit-signature', '0'.repeat(64))
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('accepts a valid signature with an unknown reference → 200 OK (no-op)', async () => {
    const ref     = `PU-UNKNOWN-${Date.now()}`
    const payload  = payunitWebhookPayload({ reference: ref })
    const { body, signature } = signPayunitWebhook(payload)

    await request(app)
      .post('/api/v1/payments/payunit/webhook')
      .set('Content-Type', 'application/json')
      .set('x-payunit-signature', signature)
      .send(body)
      .expect(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EVERSEND
// ─────────────────────────────────────────────────────────────────────────────

describe('Eversend webhook — security & idempotency', () => {
  it('rejects a request with no signature header → 401', async () => {
    const payload = eversendWebhookPayload()
    await request(app)
      .post('/api/v1/payments/eversend/webhook')
      .type('application/json')
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('rejects a request with an incorrect signature → 401', async () => {
    const payload = eversendWebhookPayload()
    // Send a hex string of the wrong length; timingSafeEqual will catch it
    const badSig = 'a'.repeat(128) // 128 hex chars = 64 bytes, wrong digest value
    await request(app)
      .post('/api/v1/payments/eversend/webhook')
      .type('application/json')
      .set('x-eversend-signature', badSig)
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('credits wallet on a valid transaction.success event', async () => {
    const user = await createUser()
    const ref  = `EVSND-VALID-${Date.now()}`

    await Transaction.create({
      user_id:     user._id,
      reference:   ref,
      gateway:     'eversend',
      type:        'deposit',
      amount:      3000,
      status:      'pending',
      description: 'eversend deposit',
    })

    const payload            = eversendWebhookPayload({ reference: ref, amount: 3000 })
    const { body, signature } = signEversendWebhook(payload)

    const res = await request(app)
      .post('/api/v1/payments/eversend/webhook')
      .type('application/json')
      .set('x-eversend-signature', signature)
      .send(body)

    expect(res.status).toBe(200)

    const updated = await User.findById(user._id).lean()
    expect(updated.wallet_balance).toBe(3000)
  })

  it('is idempotent — a duplicate webhook does NOT double-credit the wallet', async () => {
    const user = await createUser()
    const ref  = `EVSND-IDEM-${Date.now()}`

    await Transaction.create({
      user_id:     user._id,
      reference:   ref,
      gateway:     'eversend',
      type:        'deposit',
      amount:      2000,
      status:      'pending',
      description: 'eversend idempotency test',
    })

    const payload            = eversendWebhookPayload({ reference: ref, amount: 2000 })
    const { body, signature } = signEversendWebhook(payload)

    const sendHook = () =>
      request(app)
        .post('/api/v1/payments/eversend/webhook')
        .type('application/json')
        .set('x-eversend-signature', signature)
        .send(body)

    // First delivery
    await sendHook().expect(200)
    const balanceAfterFirst = (await User.findById(user._id).lean()).wallet_balance
    expect(balanceAfterFirst).toBe(2000)

    // Duplicate delivery — atomic claim returns null → no re-credit
    await sendHook().expect(200)
    const balanceAfterSecond = (await User.findById(user._id).lean()).wallet_balance
    expect(balanceAfterSecond).toBe(2000) // unchanged — not 4_000
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PAWAPAY — DEPOSIT WEBHOOK
// ─────────────────────────────────────────────────────────────────────────────

describe('PawaPay deposit webhook — security', () => {
  it('rejects a request with no content-digest header → 401', async () => {
    const payload = pawapayDepositWebhookPayload()
    await request(app)
      .post('/api/v1/payments/pawapay/webhook/deposit')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('rejects a request with an incorrect content-digest → 401', async () => {
    const payload = pawapayDepositWebhookPayload()
    const badDigest = 'sha-256=:' + Buffer.alloc(32).toString('base64') + ':'
    await request(app)
      .post('/api/v1/payments/pawapay/webhook/deposit')
      .set('Content-Type', 'application/json')
      .set('content-digest', badDigest)
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('accepts a valid content-digest with an unknown depositId → 200 OK (no-op)', async () => {
    const payload = pawapayDepositWebhookPayload({ depositId: crypto.randomUUID() })
    const { body, contentDigest } = signPawapayWebhook(payload)
    await request(app)
      .post('/api/v1/payments/pawapay/webhook/deposit')
      .set('Content-Type', 'application/json')
      .set('content-digest', contentDigest)
      .send(body)
      .expect(200)
  })
})

describe('PawaPay deposit webhook — wallet credit & idempotency', () => {
  it('credits wallet on a valid COMPLETED deposit', async () => {
    const user      = await createUser()
    const depositId = crypto.randomUUID()
    const ref       = `AURA-PP-${depositId}`

    await Transaction.create({
      user_id:     user._id,
      reference:   ref,
      gateway:     'pawapay',
      type:        'deposit',
      amount:      5000,
      status:      'pending',
      description: 'pawapay deposit test',
    })

    const payload            = pawapayDepositWebhookPayload({ depositId, status: 'COMPLETED', amount: '5000.00' })
    const { body, contentDigest } = signPawapayWebhook(payload)

    const res = await request(app)
      .post('/api/v1/payments/pawapay/webhook/deposit')
      .set('Content-Type', 'application/json')
      .set('content-digest', contentDigest)
      .send(body)

    expect(res.status).toBe(200)

    const updated = await User.findById(user._id).lean()
    expect(updated.wallet_balance).toBe(5000)
  })

  it('is idempotent — a duplicate deposit webhook does NOT double-credit the wallet', async () => {
    const user      = await createUser()
    const depositId = crypto.randomUUID()
    const ref       = `AURA-PP-${depositId}`

    await Transaction.create({
      user_id:     user._id,
      reference:   ref,
      gateway:     'pawapay',
      type:        'deposit',
      amount:      3000,
      status:      'pending',
      description: 'pawapay idempotency test',
    })

    const payload            = pawapayDepositWebhookPayload({ depositId, status: 'COMPLETED', amount: '3000.00' })
    const { body, contentDigest } = signPawapayWebhook(payload)

    const sendHook = () =>
      request(app)
        .post('/api/v1/payments/pawapay/webhook/deposit')
        .set('Content-Type', 'application/json')
        .set('content-digest', contentDigest)
        .send(body)

    // First delivery
    await sendHook().expect(200)
    const afterFirst = (await User.findById(user._id).lean()).wallet_balance
    expect(afterFirst).toBe(3000)

    // Duplicate — atomic claim returns null → no re-credit
    await sendHook().expect(200)
    const afterSecond = (await User.findById(user._id).lean()).wallet_balance
    expect(afterSecond).toBe(3000) // unchanged — not 6_000
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PAWAPAY — CHECKOUT WEBHOOK
// ─────────────────────────────────────────────────────────────────────────────

describe('PawaPay checkout webhook — security', () => {
  it('rejects a request with no content-digest header → 401', async () => {
    const payload = pawapayCheckoutWebhookPayload()
    await request(app)
      .post('/api/v1/payments/pawapay/webhook/checkout')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload))
      .expect(401)
  })

  it('accepts a valid content-digest with an unknown checkoutId → 200 OK (no-op)', async () => {
    const payload = pawapayCheckoutWebhookPayload({ checkoutId: crypto.randomUUID() })
    const { body, contentDigest } = signPawapayWebhook(payload)
    await request(app)
      .post('/api/v1/payments/pawapay/webhook/checkout')
      .set('Content-Type', 'application/json')
      .set('content-digest', contentDigest)
      .send(body)
      .expect(200)
  })
})

describe('PawaPay checkout webhook — wallet credit', () => {
  it('credits wallet on a COMPLETED checkout', async () => {
    const user       = await createUser()
    const checkoutId = crypto.randomUUID()
    const ref        = `AURA-PPC-${checkoutId}`

    await Transaction.create({
      user_id:     user._id,
      reference:   ref,
      gateway:     'pawapay',
      type:        'deposit',
      amount:      4000,
      status:      'pending',
      description: 'pawapay checkout test',
      metadata:    { checkoutId, checkout_flow: true },
    })

    const payload            = pawapayCheckoutWebhookPayload({ checkoutId, status: 'COMPLETED' })
    const { body, contentDigest } = signPawapayWebhook(payload)

    const res = await request(app)
      .post('/api/v1/payments/pawapay/webhook/checkout')
      .set('Content-Type', 'application/json')
      .set('content-digest', contentDigest)
      .send(body)

    expect(res.status).toBe(200)

    const updated = await User.findById(user._id).lean()
    expect(updated.wallet_balance).toBe(4000)
  })
})
