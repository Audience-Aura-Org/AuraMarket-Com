'use strict'
/**
 * tests/integration/wallet-ratelimit.test.js
 * Wallet traffic must not be throttled by the auth-grade limiter.
 *
 * Balance reads are polled by every open tab (top nav, wallet pages) and
 * many users share one public IP behind mobile carrier NAT. Reads therefore
 * fall under the general API limiter only; money-moving writes get their
 * own per-user limit.
 */

const request = require('supertest')

const { buildApp }   = require('../setup/app')
const { createUser } = require('../factories')
const { asUser }     = require('../helpers/auth')

let app
beforeAll(() => { app = buildApp() })

describe('Wallet rate limiting', () => {
  it('does not throttle balance reads at the auth limit (120 per 15 min per IP)', async () => {
    const user = await createUser({ wallet_balance: 5000 })
    let last
    for (let i = 0; i < 130; i += 1) {
      last = await request(app).get('/api/v1/wallet').set(asUser(user))
      if (last.status !== 200) break
    }
    expect(last.status).toBe(200)
    expect(last.body.data.balance).toBe(5000)
  })

  it('limits money-moving writes per user, not per shared IP', async () => {
    const heavy = await createUser({ wallet_balance: 0 })
    const neighbour = await createUser({ wallet_balance: 0 })

    let status
    for (let i = 0; i < 31; i += 1) {
      status = (await request(app).post('/api/v1/wallet/withdraw').set(asUser(heavy)).send({})).status
    }
    expect(status).toBe(429)

    // Same IP, different person: still allowed to try.
    const other = await request(app).post('/api/v1/wallet/withdraw').set(asUser(neighbour)).send({})
    expect(other.status).not.toBe(429)
  })
})
