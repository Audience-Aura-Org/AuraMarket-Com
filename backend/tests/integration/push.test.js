'use strict'
/**
 * tests/integration/push.test.js
 * Prompt 14 — Push notification subscription management.
 *
 * Sections:
 *   1. GET  /push/vapid-public-key  — public VAPID key (no auth)
 *   2. POST /push/subscribe         — save a push subscription
 *   3. POST /push/unsubscribe       — remove a push subscription
 */

const request = require('supertest')

const { buildApp }          = require('../setup/app')
const { createUser }        = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const PushSubscription = require('../../models/PushSubscription.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A minimal but structurally valid Web Push subscription object. */
const fakeSubscription = (suffix = Date.now()) => ({
  endpoint: `https://push.example.com/subscribe/${suffix}`,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlTihi1rRVdAIB9dBBxsrRdUOY_OAMvp',
    auth:   'tBHItJI5svbpez7KI4CCXg',
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /push/vapid-public-key
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /push/vapid-public-key — get VAPID public key', () => {
  it('returns the VAPID public key without authentication', async () => {
    const res = await request(app).get('/api/v1/push/vapid-public-key')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.publicKey).toBe('string')
    expect(res.body.data.publicKey.length).toBeGreaterThan(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /push/subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /push/subscribe — save a push subscription', () => {
  it('saves a push subscription and returns 200/201', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/push/subscribe')
      .set(authHeader(signToken(user)))
      .send({ subscription: fakeSubscription(), device_type: 'mobile' })

    // Controller can return 200 (refresh) or 201 (new)
    expect([200, 201]).toContain(res.status)
    expect(res.body.success).toBe(true)
  })

  it('is idempotent — re-subscribing with the same endpoint is accepted', async () => {
    const user = await createUser()
    const sub  = fakeSubscription()

    await request(app)
      .post('/api/v1/push/subscribe')
      .set(authHeader(signToken(user)))
      .send({ subscription: sub, device_type: 'mobile' })

    const res = await request(app)
      .post('/api/v1/push/subscribe')
      .set(authHeader(signToken(user)))
      .send({ subscription: sub, device_type: 'mobile' })

    expect(res.body.success).toBe(true)
  })

  it('returns 400 when subscription data is missing', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/push/subscribe')
      .set(authHeader(signToken(user)))
      .send({})  // missing subscription

    expect(res.status).toBe(400)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/push/subscribe')
      .send({ subscription: fakeSubscription() })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /push/unsubscribe — remove a push subscription
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /push/unsubscribe — remove a push subscription', () => {
  it('removes an existing push subscription and returns 200', async () => {
    const user = await createUser()
    const sub  = fakeSubscription(Date.now() + 1)

    // Subscribe first
    await request(app)
      .post('/api/v1/push/subscribe')
      .set(authHeader(signToken(user)))
      .send({ subscription: sub })

    // Then unsubscribe
    const res = await request(app)
      .post('/api/v1/push/unsubscribe')
      .set(authHeader(signToken(user)))
      .send({ endpoint: sub.endpoint })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Confirm it's gone from DB
    const remaining = await PushSubscription.findOne({
      user_id: user._id,
      'subscription.endpoint': sub.endpoint,
    })
    expect(remaining).toBeNull()
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/push/unsubscribe')
      .send({ endpoint: 'https://push.example.com/test' })

    expect(res.status).toBe(401)
  })
})

it('supports multiple browser subscriptions for one account without an Android token', async () => {
  await PushSubscription.init()
  const user = await createUser()
  for (const suffix of ['desktop-a', 'phone-b']) {
    const res = await request(app).post('/api/v1/push/subscribe').set(authHeader(signToken(user))).send({ subscription: fakeSubscription(suffix) })
    expect([200,201]).toContain(res.status)
  }
  expect(await PushSubscription.countDocuments({user_id:user._id,channel:'web'})).toBe(2)
})

it('stores notification preferences per account and rejects unsupported fields', async () => {
  const user = await createUser(), other=await createUser()
  const changed = await request(app).patch('/api/v1/users/notification-preferences').set(authHeader(signToken(user))).send({push_orders:false})
  expect(changed.status).toBe(200);expect(changed.body.data.push_orders).toBe(false)
  const mine = await request(app).get('/api/v1/users/notification-preferences').set(authHeader(signToken(user)))
  const theirs = await request(app).get('/api/v1/users/notification-preferences').set(authHeader(signToken(other)))
  expect(mine.body.data.push_orders).toBe(false);expect(theirs.body.data.push_orders).toBe(true)
  expect((await request(app).patch('/api/v1/users/notification-preferences').set(authHeader(signToken(user))).send({wallet_balance:99999})).status).toBe(400)
})
