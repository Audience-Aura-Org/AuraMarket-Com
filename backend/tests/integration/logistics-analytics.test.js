'use strict'
/**
 * tests/integration/logistics-analytics.test.js
 * GET /logistics/analytics — firm-wide figures computed on the server over
 * ALL shipments (the page used to derive them from the newest 50).
 */

const request = require('supertest')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const { buildApp } = require('../setup/app')
const { createUser } = require('../factories')
const { asUser } = require('../helpers/auth')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const Shipment = require('../../models/Shipment.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

let user, firm
beforeEach(async () => {
  await PlatformSettings.create({ subscription_required_roles: { vendor: false, logistics: false, customer: false } })
  user = await createUser({ role: 'logistics' })
  firm = await LogisticsCompany.create({
    user_id: user._id, company_name: faker.company.name(),
    contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000000',
  })
})

let seq = 0
const ship = (status, extra = {}) => ({
  _id: new mongoose.Types.ObjectId(), logistics_id: firm._id, vendor_id: new mongoose.Types.ObjectId(),
  tracking_code: `AURA-T${Date.now()}${seq++}`, price: 1000, status,
  createdAt: new Date(), updatedAt: new Date(), ...extra,
})

describe('GET /logistics/analytics', () => {
  it('counts every shipment, not just the newest page', async () => {
    const docs = [
      ...Array.from({ length: 70 }, () => ship('delivered', { delivery_address: { region: 'Littoral' } })),
      ...Array.from({ length: 10 }, () => ship('in_transit', { delivery_address: { region: 'Centre' } })),
      ship('pending'), ship('assigned'), ship('failed'), ship('cancelled'),
      ship('delivered', { createdAt: new Date(Date.now() - 40 * 864e5) }), // outside the 30-day series
    ]
    await Shipment.collection.insertMany(docs)

    const res = await request(app).get('/api/v1/logistics/analytics').set(asUser(user))

    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.totals).toEqual({ total: 85, delivered: 71, active: 11, pending: 1, failed: 1, cancelled: 1 })
    expect(d.delivery_rate).toBeCloseTo(71 / 73, 5)               // delivered ÷ finished (delivered+failed+cancelled)
    expect(d.daily).toHaveLength(30)
    expect(d.daily.reduce((s, x) => s + x.count, 0)).toBe(84)     // the 40-day-old one is outside the window
    expect(d.regions[0]).toEqual({ name: 'Littoral', count: 71 - 1 })
  })

  it('reports no delivery rate (not 100%) when nothing has finished yet', async () => {
    await Shipment.collection.insertOne(ship('pending'))
    const res = await request(app).get('/api/v1/logistics/analytics').set(asUser(user))
    expect(res.body.data.delivery_rate).toBeNull()
  })
})
