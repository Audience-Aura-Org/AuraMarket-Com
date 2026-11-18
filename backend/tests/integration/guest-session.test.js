'use strict'
/**
 * tests/integration/guest-session.test.js
 * Instant Buy Now: visitors without an account get a hidden guest customer
 * and a session that can place orders but not touch account features.
 */

const request = require('supertest')

const { buildApp }    = require('../setup/app')
const { createAdmin } = require('../factories')
const { asUser }      = require('../helpers/auth')

const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })
beforeEach(async () => { await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { instant_buy: true } }]) })

const newGuest = () => request(app).post('/api/v1/auth/guest').send({})

describe('POST /auth/guest', () => {
  it('creates a new guest each call', async () => {
    const a = await newGuest()
    const b = await newGuest()
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(a.body.token).toBeTruthy()
    expect(a.body.data.user._id).not.toBe(b.body.data.user._id)
    for (const res of [a, b]) {
      expect(res.body.data.user).toMatchObject({ is_guest: true, role: 'customer', name: 'Guest' })
      expect(res.body.data.user.email).toMatch(/^guest-[0-9a-f]{16}@guest\.auradime\.invalid$/)
    }
  })

  it('guest token works on orders but not on the wallet or profile', async () => {
    const { body } = await newGuest()
    const auth = { Authorization: `Bearer ${body.token}` }
    expect((await request(app).get('/api/v1/orders/my-orders').set(auth)).status).toBe(200)
    const wallet = await request(app).get('/api/v1/wallet').set(auth)
    expect(wallet.status).toBe(403)
    expect(wallet.body.message).toBe('Guest accounts cannot do this.')
    expect((await request(app).patch('/api/v1/auth/update-profile').set(auth).send({ name: 'X' })).status).toBe(403)
    expect((await request(app).post('/api/v1/withdrawals').set(auth).send({})).status).toBe(403)
  })

  it('guests are left out of admin user totals', async () => {
    const admin = await createAdmin()
    const before = (await request(app).get('/api/v1/admin/analytics').set(asUser(admin))).body.data.stats.users
    await newGuest()
    const after = (await request(app).get('/api/v1/admin/analytics').set(asUser(admin))).body.data.stats.users
    expect(after).toBe(before)
  })

  it('is rate limited per IP', async () => {
    let last
    for (let i = 0; i < 65; i += 1) {
      last = await newGuest()
      if (last.status === 429) break
    }
    expect(last.status).toBe(429)
  })
})
