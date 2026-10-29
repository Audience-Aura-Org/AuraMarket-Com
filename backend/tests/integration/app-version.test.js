'use strict'
/**
 * Android app updates: the version check and recording each phone's app version.
 */
const request = require('supertest')
const { buildApp } = require('../setup/app')
const { createUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const PushSubscription = require('../../models/PushSubscription.model')

let app
beforeAll(() => { app = buildApp() })
const saved = {}
beforeEach(() => { for (const k of ['APP_LATEST_VERSION', 'APP_MIN_VERSION']) saved[k] = process.env[k]; process.env.APP_LATEST_VERSION = '1.7.1'; delete process.env.APP_MIN_VERSION })
afterEach(() => { for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v) })

describe('GET /app/version', () => {
  it('offers an update to older versions and forces it below the minimum', async () => {
    const old = await request(app).get('/api/v1/app/version').query({ v: '1.6.1' })
    expect(old.body.data).toMatchObject({ latest: '1.7.1', update_available: true, update_required: false, download_url: 'https://auradime.com/downloads/Auradime.apk' })
    expect((await request(app).get('/api/v1/app/version').query({ v: '1.7.1' })).body.data.update_available).toBe(false)
    expect((await request(app).get('/api/v1/app/version').query({ v: '1.10.0' })).body.data.update_available).toBe(false) // numeric, not string, comparison
    process.env.APP_MIN_VERSION = '1.7.0'
    expect((await request(app).get('/api/v1/app/version').query({ v: '1.6.1' })).body.data.update_required).toBe(true)
  })
})

describe('Android push token', () => {
  it('records the app version, and none for old apps', async () => {
    const u = await createUser()
    await request(app).post('/api/v1/push/native-token').set(authHeader(signToken(u))).send({ token: 'tok-new', platform: 'android', app_version: '1.7.1' })
    await request(app).post('/api/v1/push/native-token').set(authHeader(signToken(u))).send({ token: 'tok-old', platform: 'android' })
    await request(app).post('/api/v1/push/native-token').set(authHeader(signToken(u))).send({ token: 'tok-bad', platform: 'android', app_version: '<script>' })
    const rows = Object.fromEntries((await PushSubscription.find({ user_id: u._id }).lean()).map((r) => [r.fcm_token, r.app_version]))
    expect(rows).toEqual({ 'tok-new': '1.7.1', 'tok-old': null, 'tok-bad': null })
  })
})
