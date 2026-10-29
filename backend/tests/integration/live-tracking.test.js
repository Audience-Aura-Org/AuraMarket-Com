'use strict'
/**
 * Phase 5: live rider position. Riders report only during an accepted delivery that
 * is under way; parties and tracking-link holders see it, nobody else does.
 */
const request = require('supertest')
const crypto = require('crypto')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Shipment = require('../../models/Shipment.model')
const RiderProfile = require('../../models/RiderProfile.model')
const DeliveryAssignment = require('../../models/DeliveryAssignment.model')
const links = require('../../services/trackingLink.service')

let app
beforeAll(() => { app = buildApp() })

let firm, riderUser, riderAuth, customer, stranger, shipment, token
const FIX = { lat: 4.0612, lng: 9.7311, accuracy_m: 12.4 }
const setLive = (on) => PlatformSettings.updateOne({}, { $set: { 'features.live_tracking': on } })

beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true, live_tracking: true } }])
  const owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  riderUser = await createUser({ name: 'Paul Rider' })
  riderAuth = authHeader(signToken(riderUser))
  await RiderProfile.create({ user_id: riderUser._id, agency_id: firm._id, status: 'active', availability: 'busy' })
  customer = await createUser()
  stranger = await createUser()
  const doc = new Shipment({
    type: 'p2p', booked_by: customer._id, logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    status: 'picked_up', price: 1500, payment_status: 'paid',
    pickup_address: { quartier: 'Akwa', city: 'Douala' }, delivery_address: { quartier: 'Bonamoussadi', city: 'Douala' },
    other_party: { name: 'Jean', phone: '699987654' }, package_details: { category: 'clothing', weight_tier: 'light', description: 'Shoes' },
    shipment_logs: [{ status: 'picked_up', timestamp: new Date() }],
  })
  token = links.issueToken(doc)
  shipment = await doc.save()
  await DeliveryAssignment.create({ shipment_id: shipment._id, agency_id: firm._id, rider_id: riderUser._id, status: 'accepted', mode: 'manual', expires_at: new Date(Date.now() + 60000) })
})

const report = (body = FIX) => request(app).post('/api/v1/riders/me/location').set(riderAuth).send(body)

describe('Rider reports position', () => {
  it('stores a fix during an accepted delivery, and throttles bursts', async () => {
    const first = await report()
    expect(first.status).toBe(200)
    expect(first.body.data.stored).toBe(true)
    expect((await report()).body.data.stored).toBe(false)
    const p = await RiderProfile.findOne({ user_id: riderUser._id }).lean()
    expect(p.last_location).toMatchObject({ lat: FIX.lat, lng: FIX.lng, accuracy_m: 12 })
  })

  it('refuses outside a delivery, with bad coordinates, or when the feature is off', async () => {
    expect((await report({ lat: 'x', lng: 9.7 })).status).toBe(400)
    await Shipment.updateOne({ _id: shipment._id }, { $set: { status: 'delivered' } })
    expect((await report()).status).toBe(409)
    await setLive(false)
    expect((await report()).status).toBe(403)
    const other = await createUser()
    await setLive(true)
    expect((await request(app).post('/api/v1/riders/me/location').set(authHeader(signToken(other))).send(FIX)).status).toBe(403)
  })
})

describe('Customers see the rider', () => {
  it('shows the position to the booker and to the tracking-link holder only', async () => {
    await report()
    const byCode = await request(app).get(`/api/v1/p2p/track/${shipment.tracking_code}/live`).set(authHeader(signToken(customer)))
    expect(byCode.body.data).toMatchObject({ live: true, status: 'picked_up', rider: { lat: FIX.lat, lng: FIX.lng } })

    const byLink = await request(app).get(`/api/v1/track/${token}/live`)
    expect(byLink.body.data.live).toBe(true)

    expect((await request(app).get(`/api/v1/p2p/track/${shipment.tracking_code}/live`).set(authHeader(signToken(stranger)))).status).toBe(404)
    expect((await request(app).get(`/api/v1/p2p/track/${shipment.tracking_code}/live`)).status).toBe(401)
    expect((await request(app).get('/api/v1/track/not-a-real-token-but-long-enough/live')).status).toBe(404)
  })

  it('hides stale fixes and finished deliveries', async () => {
    await RiderProfile.updateOne({ user_id: riderUser._id }, { $set: { last_location: { ...FIX, at: new Date(Date.now() - 10 * 60000) } } })
    const stale = await request(app).get(`/api/v1/track/${token}/live`)
    expect(stale.body.data).toMatchObject({ live: false, reason: 'no_signal' })

    await RiderProfile.updateOne({ user_id: riderUser._id }, { $set: { 'last_location.at': new Date() } })
    await Shipment.updateOne({ _id: shipment._id }, { $set: { status: 'delivered' } })
    const done = await request(app).get(`/api/v1/track/${token}/live`)
    expect(done.body.data).toMatchObject({ live: false, reason: 'not_under_way' })
  })
})

describe('Route and arrival time', () => {
  const routing = require('../../services/routing.service')
  afterEach(() => { vi.restoreAllMocks(); delete process.env.ORS_API_KEY })

  it('shows who is coming, the road route and minutes to the drop-off, reusing a recent route', async () => {
    process.env.ORS_API_KEY = 'test-key'
    const ors = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { coordinates: [[9.7311, 4.0612], [9.735, 4.07], [9.7427, 4.0946]] }, properties: { summary: { distance: 4700, duration: 660 }, segments: [{ distance: 4700, duration: 660 }] } }] }),
    })
    await RiderProfile.updateOne({ user_id: riderUser._id }, { $set: { vehicle_plate: 'LT 123 AB', phone: '677111222' } })
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'delivery_address.location': { lat: 4.0946, lng: 9.7427 } } })
    await report()
    const r = await request(app).get(`/api/v1/track/${token}/live`)
    expect(r.body.data.rider_info).toMatchObject({ name: 'Paul', vehicle_type: 'motorcycle', vehicle_plate: 'LT 123 AB', phone: '677111222' })
    expect(r.body.data.route).toMatchObject({ heading_to: 'dropoff', distance_km: 4.7, dropoff_eta_min: 11, pickup_eta_min: null })
    expect(r.body.data.route.coordinates).toHaveLength(3)
    await request(app).get(`/api/v1/track/${token}/live`)
    expect(ors).toHaveBeenCalledTimes(1) // same position within a minute: cached
  })

  it('still says who is coming before the first GPS fix', async () => {
    const r = await request(app).get(`/api/v1/track/${token}/live`)
    expect(r.body.data).toMatchObject({ live: false, reason: 'no_signal', rider_info: { name: 'Paul' } })
  })
})
