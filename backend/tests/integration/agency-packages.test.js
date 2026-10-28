'use strict'
/**
 * Phase 3 — agency-registered packages and secure tracking links.
 */
const request = require('supertest')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createLogisticsUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const LogisticsCompany = require('../../models/LogisticsCompany.model')
const LogisticZone = require('../../models/LogisticZone.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Shipment = require('../../models/Shipment.model')
const Transaction = require('../../models/Transaction.model')
const User = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

let owner, firm, otherOwner, akwa, bonamoussadi, makepe
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { agency_packages: true, tracking_links: true } }])
  const douala = await LogisticZone.create({ name: 'Douala', type: 'city', level: 0 })
  const q = (name) => LogisticZone.create({ name, type: 'quartier', level: 1, parent_id: douala._id, ancestors: [douala._id] })
  akwa = await q('Akwa'); bonamoussadi = await q('Bonamoussadi'); makepe = await q('Makèpè')
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099',
    service_regions: ['Douala'], vehicle_types: ['motorcycle'], is_verified: true,
    quartier_prices: [{ quartier: 'Bonamoussadi', price: 1500, zone_id: bonamoussadi._id }] })
  otherOwner = await createLogisticsUser()
  await LogisticsCompany.create({ user_id: otherOwner._id, company_name: 'Other', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000098', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
})

const body = (extra = {}) => ({
  description: 'Two boxes of shoes', category: 'clothing', reference: 'INV-2041',
  sender: { name: 'Mama Ngozi', phone: '677123456' }, recipient: { name: 'Jean Mbarga', phone: '699 98 76 54' },
  pickup: { zone_id: akwa._id, street: 'Rue 1.234', location: { lat: 4.0483, lng: 9.6966, source: 'pin' } },
  delivery: { zone_id: bonamoussadi._id, landmark: 'Blue gate after the pharmacy', location: { lat: 4.0946, lng: 9.7427, source: 'search' } },
  ...extra,
})
const create = (who, extra) => request(app).post('/api/v1/logistics/packages').set(authHeader(signToken(who))).send(body(extra))

describe('POST /logistics/packages', () => {
  it('registers a package at the agency’s district price and returns a shareable link', async () => {
    const res = await create(owner)
    expect(res.status).toBe(201)
    const { shipment, tracking_link, whatsapp_url, whatsapp_text } = res.body.data
    expect(shipment).toMatchObject({ type: 'agency', status: 'pending', price: 1500, payment_status: 'paid' })
    expect(shipment.agency_package).toMatchObject({ reference: 'INV-2041', fee_source: 'district', payer: 'sender' })
    expect(shipment.delivery_address).toMatchObject({ quartier: 'Bonamoussadi', city: 'Douala', landmark: 'Blue gate after the pharmacy' })
    expect(shipment.tracking_token_hash).toBeUndefined() // never sent to the client
    expect(tracking_link).toMatch(/\/delivery\/track\?t=[A-Za-z0-9_-]{32}$/)
    expect(whatsapp_url).toMatch(/^https:\/\/wa\.me\/237699987654\?text=/)
    expect(whatsapp_text).toContain(tracking_link)
  })

  it('records an agency’s own fee as manual and refuses a destination with no price and no fee', async () => {
    expect((await create(owner, { fee: 2000 })).body.data.shipment.agency_package.fee_source).toBe('manual')
    const res = await create(owner, { delivery: { zone_id: makepe._id } })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/no price for Makèpè/)
  })

  it('tracks what the recipient owes when they pay on delivery', async () => {
    const res = await create(owner, { payer: 'recipient' })
    expect(res.body.data.shipment).toMatchObject({ payment_status: 'unpaid', agency_package: { payment_arrangement: 'pay_on_delivery', amount_due_on_delivery: 1500 } })
  })

  it('is blocked while the agency_packages flag is off', async () => {
    await PlatformSettings.updateOne({}, { $set: { features: { agency_packages: false } } })
    expect((await create(owner)).status).toBe(403)
  })
})

describe('Tracking links', () => {
  it('shows progress to the link holder without personal details, and stores only a hash', async () => {
    const { tracking_link, shipment } = (await create(owner)).body.data
    const token = tracking_link.split('t=')[1]
    const stored = await Shipment.findById(shipment._id).select('+tracking_token_hash').lean() // hidden by default
    expect(stored.tracking_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(stored)).not.toContain(token)

    const res = await request(app).get(`/api/v1/track/${token}`)
    expect(res.status).toBe(200)
    const out = res.body.data.shipment
    expect(out).toMatchObject({ status: 'pending', redacted: true, logistics_id: { company_name: 'FastShip', contact_phone: '+237600000099' } })
    const json = JSON.stringify(out)
    for (const secret of ['677123456', '699987654', 'Mbarga', 'Rue 1.234', 'Blue gate', '4.0946', 'INV-2041', 'tracking_token_hash']) expect(json).not.toContain(secret)
  })

  it('replacing a link turns the old one off', async () => {
    const { tracking_link, shipment } = (await create(owner)).body.data
    const fresh = await request(app).post(`/api/v1/logistics/shipments/${shipment._id}/tracking-link`).set(authHeader(signToken(owner)))
    expect(fresh.status).toBe(200)
    expect((await request(app).get(`/api/v1/track/${tracking_link.split('t=')[1]}`)).status).toBe(404)
    expect((await request(app).get(`/api/v1/track/${fresh.body.data.tracking_link.split('t=')[1]}`)).status).toBe(200)
  })

  it('cannot be created for another agency’s shipment', async () => {
    const { shipment } = (await create(owner)).body.data
    expect((await request(app).post(`/api/v1/logistics/shipments/${shipment._id}/tracking-link`).set(authHeader(signToken(otherOwner)))).status).toBe(404)
  })

  it('expires after delivery, and delivering never pays the agency from the platform', async () => {
    const { tracking_link, shipment } = (await create(owner)).body.data
    const token = tracking_link.split('t=')[1]
    const auth = authHeader(signToken(owner))
    for (const status of ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered']) {
      const r = await request(app).patch(`/api/v1/logistics/shipments/${shipment._id}/status`).set(auth).send({ status, note: status, proof_image: 'https://cdn.test/p.jpg' })
      expect(r.status).toBe(200)
    }
    expect((await request(app).get(`/api/v1/track/${token}`)).status).toBe(200) // still viewable right after delivery

    const payouts = await Transaction.countDocuments({ user_id: owner._id, type: 'payout' })
    expect(payouts).toBe(0)
    expect((await User.findById(owner._id)).wallet_balance || 0).toBe(0)

    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'shipment_logs.$[d].timestamp': new Date(Date.now() - 73 * 3600 * 1000) } }, { arrayFilters: [{ 'd.status': 'delivered' }] })
    expect((await request(app).get(`/api/v1/track/${token}`)).status).toBe(410)
  })

  it('rejects malformed tokens', async () => {
    expect((await request(app).get('/api/v1/track/abc')).status).toBe(404)
  })
})
