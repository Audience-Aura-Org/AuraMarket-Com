'use strict'
/**
 * WhatsApp channel: Meta webhook verification/signatures, statuses, STOP opt-out,
 * customer opt-in, and notifier gating (opt-in + flag + category).
 */
const request = require('supertest')
const crypto = require('crypto')
const { buildApp } = require('../setup/app')
const { createUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const User = require('../../models/User.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const WhatsAppMessage = require('../../models/WhatsAppMessage.model')
const { sendNotification } = require('../../utils/notifier')
const whatsapp = require('../../services/whatsapp.service')

let app
const ENV = { WHATSAPP_VERIFY_TOKEN: 'verify-me-123', WHATSAPP_APP_SECRET: 'app-secret-xyz' }
let saved
beforeAll(() => { app = buildApp() })
beforeEach(async () => {
  saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]))
  Object.assign(process.env, ENV)
  delete process.env.WHATSAPP_TOKEN // dry-run: nothing leaves the test
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { whatsapp_notifications: true } }])
})
afterEach(() => { for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v) })

const sign = (body) => `sha256=${crypto.createHmac('sha256', ENV.WHATSAPP_APP_SECRET).update(body).digest('hex')}`
const post = (payload, signature) => {
  const body = JSON.stringify(payload)
  return request(app).post('/api/v1/whatsapp/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', signature ?? sign(body)).send(body)
}
const waitFor = async (fn, ms = 3000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 50)) } return v }

describe('Meta webhook', () => {
  it('answers the verification handshake only with the right token', async () => {
    const ok = await request(app).get('/api/v1/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me-123', 'hub.challenge': '1158201444' })
    expect(ok.status).toBe(200)
    expect(ok.text).toBe('1158201444')
    expect((await request(app).get('/api/v1/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x' })).status).toBe(403)
  })

  it('rejects events that are not signed with the app secret', async () => {
    expect((await post({ entry: [] }, 'sha256=deadbeef')).status).toBe(401)
    expect((await post({ entry: [] })).status).toBe(200)
  })

  it('moves message status forward only, and STOP opts the sender out', async () => {
    const user = await createUser({ whatsapp: { opted_in: true, number: '237677123456' } })
    await WhatsAppMessage.create({ to: '237677123456', template: 'auradime_update', status: 'accepted', wa_message_id: 'wamid.1' })
    await post({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read', timestamp: '1761600000' }] } }] }] })
    await post({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1761599990' }] } }] }] })
    expect((await waitFor(async () => { const m = await WhatsAppMessage.findOne({ wa_message_id: 'wamid.1' }); return m.status === 'read' && m }))?.status).toBe('read')

    await post({ entry: [{ changes: [{ value: { messages: [{ from: '237677123456', type: 'text', text: { body: 'STOP' } }] } }] }] })
    const after = await waitFor(async () => { const u = await User.findById(user._id); return u.whatsapp.opted_in === false && u })
    expect(after.whatsapp.opted_in).toBe(false)
  })
})

describe('Opt-in', () => {
  it('lets a user opt in with a Cameroon number and opt out again', async () => {
    const user = await createUser()
    const auth = authHeader(signToken(user))
    expect((await request(app).put('/api/v1/whatsapp/me').set(auth).send({ opted_in: true, number: '12' })).status).toBe(400)
    const on = await request(app).put('/api/v1/whatsapp/me').set(auth).send({ opted_in: true, number: '677 12 34 56' })
    expect(on.body.data).toMatchObject({ opted_in: true, number: '237677123456' })
    const off = await request(app).put('/api/v1/whatsapp/me').set(auth).send({ opted_in: false })
    expect(off.body.data.opted_in).toBe(false)
  })
})

describe('Notifier → WhatsApp', () => {
  it('sends order updates to opted-in users only, never chat messages, and only while the flag is on', async () => {
    const optedIn = await createUser({ whatsapp: { opted_in: true, number: '237677123456' } })
    const notOptedIn = await createUser({ phone: '699000111' })
    await sendNotification(null, optedIn._id, { title: 'Order Updated: Shipped', message: 'Your order is on its way.', type: 'order_status', metadata: { link: '/orders/1' } })
    await sendNotification(null, optedIn._id, { title: 'New message', message: 'Hi', type: 'message' })
    await sendNotification(null, notOptedIn._id, { title: 'Order Updated', message: 'x', type: 'order_status' })
    const sent = await waitFor(() => WhatsAppMessage.find({}).lean().then((r) => r.length && r))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: '237677123456', template: 'auradime_update', status: 'dry_run' })

    await PlatformSettings.updateOne({}, { $set: { features: { whatsapp_notifications: false } } })
    await sendNotification(null, optedIn._id, { title: 'Order Updated: Delivered', message: 'Delivered.', type: 'order_status' })
    await new Promise((r) => setTimeout(r, 400))
    expect(await WhatsAppMessage.countDocuments()).toBe(1)
  })

  it('normalises numbers to the WhatsApp format', () => {
    expect(whatsapp.toWaNumber('677 12 34 56')).toBe('237677123456')
    expect(whatsapp.toWaNumber('+237 6 77 12 34 56')).toBe('237677123456')
    expect(whatsapp.toWaNumber('12345')).toBeNull()
  })
})
