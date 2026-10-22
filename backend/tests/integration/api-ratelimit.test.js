'use strict'
/**
 * tests/integration/api-ratelimit.test.js
 * Signed-in traffic is rate limited per USER, anonymous traffic per IP.
 *
 * Mobile carriers put many customers behind one public IP (CGNAT); a
 * per-IP budget lets one busy neighbour lock everybody out.
 * Small limits are set before the app loads so the test stays fast.
 */

process.env.API_RATE_LIMIT_MAX = '30'
process.env.STRICT_RATE_LIMIT_MAX = '20'

const request = require('supertest')

const { buildApp }   = require('../setup/app')
const { createUser } = require('../factories')
const { asUser }     = require('../helpers/auth')

let app
beforeAll(() => { app = buildApp() })

const hammer = async (n, make) => {
  let last
  for (let i = 0; i < n; i += 1) last = await make()
  return last.status
}

describe('General API limiter', () => {
  it('gives each signed-in user their own budget on a shared IP', async () => {
    const heavy = await createUser()
    const neighbour = await createUser()
    expect(await hammer(31, () => request(app).get('/api/v1/wallet').set(asUser(heavy)))).toBe(429)
    expect((await request(app).get('/api/v1/wallet').set(asUser(neighbour))).status).toBe(200)
  })

  it('still limits anonymous traffic per IP', async () => {
    expect(await hammer(31, () => request(app).get('/api/v1/categories'))).toBe(429)
  })
})

describe('Strict limiter (/auth)', () => {
  it('limits signed-in session checks per user, not per shared IP', async () => {
    const heavy = await createUser()
    const neighbour = await createUser()
    expect(await hammer(21, () => request(app).get('/api/v1/auth/me').set(asUser(heavy)))).toBe(429)
    expect((await request(app).get('/api/v1/auth/me').set(asUser(neighbour))).status).toBe(200)
  })

  it('keeps anonymous auth attempts limited per IP (brute-force protection)', async () => {
    const res = await hammer(21, () => request(app).post('/api/v1/auth/send-otp').send({ email: 'x@example.com' }))
    expect(res).toBe(429)
  })

  it('a forged token does not buy a separate budget', async () => {
    const forged = { Authorization: 'Bearer not-a-real-token' }
    expect(await hammer(21, () => request(app).post('/api/v1/auth/send-otp').set(forged).send({ email: 'y@example.com' }))).toBe(429)
  })
})
