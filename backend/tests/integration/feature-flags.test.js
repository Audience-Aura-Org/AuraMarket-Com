'use strict'
const request = require('supertest')
const { buildApp } = require('../setup/app')
const { createUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app, admin
beforeAll(() => { app = buildApp() })
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage' }])
  admin = await createUser({ role: 'admin' })
})

describe('Rollout feature flags', () => {
  it('are all off by default', async () => {
    const res = await request(app).get('/api/v1/features')
    expect(res.status).toBe(200)
    expect(res.body.data.features).toMatchObject({ location_picker: false, live_tracking: false, auto_rider_dispatch: 'off', auto_agency_dispatch: 'off' })
  })

  it('lets an admin switch flags, merging over current values', async () => {
    const auth = authHeader(signToken(admin))
    await request(app).patch('/api/v1/admin/settings').set(auth).send({ features: { location_picker: true } }).expect(200)
    await request(app).patch('/api/v1/admin/settings').set(auth).send({ features: { auto_rider_dispatch: 'shadow' } }).expect(200)
    const res = await request(app).get('/api/v1/features')
    expect(res.body.data.features).toMatchObject({ location_picker: true, auto_rider_dispatch: 'shadow', live_tracking: false })
  })

  it('rejects unknown flags and invalid values', async () => {
    const auth = authHeader(signToken(admin))
    expect((await request(app).patch('/api/v1/admin/settings').set(auth).send({ features: { teleport: true } })).status).toBe(400)
    expect((await request(app).patch('/api/v1/admin/settings').set(auth).send({ features: { auto_rider_dispatch: 'maybe' } })).status).toBe(400)
    expect((await request(app).patch('/api/v1/admin/settings').set(auth).send({ features: { location_picker: 'yes' } })).status).toBe(400)
  })
})
