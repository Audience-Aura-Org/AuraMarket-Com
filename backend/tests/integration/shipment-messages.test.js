'use strict'
/**
 * tests/integration/shipment-messages.test.js
 * Delivery chat threads (/messages/shipment/:id) are private to the
 * participants: shipper, recipient, the courier firm, the order's vendor and
 * admins — plus guests who hold the tracking code (public tracking page).
 * Previously anyone could read any thread by id and anyone (even anonymous)
 * could post into it, notifying every party.
 */

const request = require('supertest')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp } = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { asUser } = require('../helpers/auth')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const Shipment = require('../../models/Shipment.model')
const ShipmentMessage = require('../../models/ShipmentMessage.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

let shipper, recipient, courierUser, stranger, shipment
beforeEach(async () => {
  await PlatformSettings.create({ subscription_required_roles: { vendor: false, logistics: false, customer: false } })
  shipper = await createUser()
  recipient = await createUser()
  stranger = await createUser()
  courierUser = await createUser({ role: 'logistics' })
  const firm = await LogisticsCompany.create({
    user_id: courierUser._id, company_name: faker.company.name(),
    contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000000',
  })
  shipment = await Shipment.create({
    logistics_id: firm._id, vendor_id: new mongoose.Types.ObjectId(),
    tracking_code: `AURA-${Date.now().toString(36).toUpperCase()}`, price: 1500,
    booked_by: shipper._id, other_party: { user_id: recipient._id, name: 'Rita', phone: '+237600000001' },
  })
  await ShipmentMessage.create({
    shipment_id: shipment._id, sender_id: shipper._id, sender_name: 'Ada', sender_role: 'shipper',
    text: 'Gate code is 4471, call +237 6 99 00 11 22', read_by: [shipper._id], timestamp: new Date(),
  })
})

const read = (agent) => agent.get(`/api/v1/messages/shipment/${shipment._id}`)
const post = (agent, body = { text: 'hello' }) => agent.post(`/api/v1/messages/shipment/${shipment._id}`).send(body)

it('restricts read acknowledgements to shipment participants', async () => {
  const path = `/api/v1/messages/shipment/${shipment._id}/read`
  expect((await request(app).patch(path).set(asUser(stranger))).status).toBe(403)
  expect((await request(app).patch(path).set(asUser(recipient))).status).toBe(200)
})

it('restricts order read acknowledgements to order participants', async () => {
  const { createOrder } = require('../factories')
  const order = await createOrder({customerId:shipper._id,vendorId:new mongoose.Types.ObjectId()})
  const path = `/api/v1/messages/order/${order._id}/read`
  expect((await request(app).patch(path).set(asUser(stranger))).status).toBe(403)
  expect((await request(app).patch(path).set(asUser(shipper))).status).toBe(200)
})

describe('reading a delivery chat', () => {
  it.each([
    ['the shipper', () => shipper],
    ['the recipient', () => recipient],
    ['the courier firm', () => courierUser],
  ])('%s can read it', async (_label, who) => {
    const res = await read(request(app)).set(asUser(who()))
    expect(res.status).toBe(200)
    expect(res.body.data.messages).toHaveLength(1)
  })

  it('an admin can read it', async () => {
    const admin = await createAdmin()
    const res = await read(request(app)).set(asUser(admin))
    expect(res.status).toBe(200)
  })

  it('a guest with the tracking code can read it (public tracking page)', async () => {
    const res = await request(app).get(`/api/v1/messages/shipment/${shipment._id}?code=${shipment.tracking_code.toLowerCase()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.messages).toHaveLength(1)
  })

  it('an anonymous visitor without the code cannot', async () => {
    const res = await read(request(app))
    expect(res.status).toBe(403)
    expect(res.body.data).toBeUndefined()
  })

  it('a signed-in stranger cannot', async () => {
    const res = await read(request(app)).set(asUser(stranger))
    expect(res.status).toBe(403)
  })

  it('a wrong tracking code does not open it', async () => {
    const res = await request(app).get(`/api/v1/messages/shipment/${shipment._id}?code=AURA-WRONG`)
    expect(res.status).toBe(403)
  })
})

describe('posting to a delivery chat', () => {
  it('a participant can post', async () => {
    const res = await post(request(app)).set(asUser(recipient))
    expect(res.status).toBe(201)
  })

  it('a guest with the tracking code can post', async () => {
    const res = await post(request(app), { text: 'on my way', code: shipment.tracking_code })
    expect(res.status).toBe(201)
  })

  it('an anonymous visitor without the code cannot post (no spam to every party)', async () => {
    const res = await post(request(app))
    expect(res.status).toBe(403)
    expect(await ShipmentMessage.countDocuments({ shipment_id: shipment._id })).toBe(1)
  })

  it('a signed-in stranger cannot post', async () => {
    const res = await post(request(app)).set(asUser(stranger))
    expect(res.status).toBe(403)
  })
})
