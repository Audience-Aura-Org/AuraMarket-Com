'use strict'
/**
 * Phase 4 — offering deliveries to riders: manual and automatic, reject/timeout
 * retries, one rider per delivery, and the rider's delivery steps.
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
const dispatch = require('../../services/riderDispatch.service')

let app
// The one-rider rule is a unique index: make sure it exists before racing offers.
beforeAll(async () => { app = buildApp(); await DeliveryAssignment.init() })

let owner, firm, otherFirm, near, far, cyclist, outsider
const setMode = (mode) => PlatformSettings.updateOne({}, { $set: { features: { rider_accounts: true, auto_rider_dispatch: mode } } })
const rider = async (agency, name, { vehicle = 'motorcycle', at = null } = {}) => {
  const user = await createUser({ name })
  await RiderProfile.create({ user_id: user._id, agency_id: agency._id, status: 'active', availability: 'online', vehicle_type: vehicle,
    availability_changed_at: new Date(), last_location: at ? { ...at, at: new Date() } : undefined })
  return user
}
const parcel = (extra = {}) => Shipment.create({
  type: 'agency', logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, status: 'pending', price: 1500, payment_status: 'paid',
  pickup_address: { quartier: 'Akwa', city: 'Douala', location: { lat: 4.0483, lng: 9.6966 } }, delivery_address: { quartier: 'Bonamoussadi', city: 'Douala' },
  other_party: { name: 'Jean', phone: '699987654' }, package_details: { category: 'clothing', weight_tier: 'light', description: 'Shoes' },
  shipment_logs: [{ status: 'pending', timestamp: new Date() }], ...extra,
})
const waitFor = async (fn, ms = 3000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 50)) } return v }

beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true, auto_rider_dispatch: 'off' } }])
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  otherFirm = await LogisticsCompany.create({ user_id: (await createLogisticsUser())._id, company_name: 'Other', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000098', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  near = await rider(firm, 'Near Rider', { at: { lat: 4.0490, lng: 9.6970 } })     // ~0.1 km from pickup
  far = await rider(firm, 'Far Rider', { at: { lat: 4.0946, lng: 9.7427 } })       // ~7 km
  cyclist = await rider(firm, 'Cyclist', { vehicle: 'bicycle' })
  outsider = await rider(otherFirm, 'Other Agency Rider', { at: { lat: 4.0484, lng: 9.6967 } }) // closest of all, wrong agency
})

describe('Automatic dispatch', () => {
  it('offers the nearest eligible rider of the shipment’s own agency', async () => {
    await setMode('on')
    const s = await parcel()
    const r = await dispatch.autoDispatch(s._id)
    expect(r.offered.toString()).toBe(near._id.toString())
    expect(r.reason).toMatch(/km from pickup/)
  })

  it('never offers heavy parcels to cyclists', async () => {
    await setMode('on')
    await RiderProfile.updateMany({ user_id: { $in: [near._id, far._id] } }, { $set: { availability: 'offline' } })
    const s = await parcel({ package_details: { category: 'household', weight_tier: 'heavy', description: 'Fridge' } })
    expect((await dispatch.autoDispatch(s._id)).reason).toBe('no_eligible_rider')
  })

  it('in shadow mode only records a suggestion', async () => {
    await setMode('shadow')
    const s = await parcel()
    await dispatch.autoDispatch(s._id)
    const after = await Shipment.findById(s._id).lean()
    expect(after.dispatch.suggested_rider_id.toString()).toBe(near._id.toString())
    expect(await DeliveryAssignment.countDocuments()).toBe(0)
  })

  it('does nothing while off, and never dispatches unpaid P2P bookings', async () => {
    const s = await parcel()
    expect((await dispatch.autoDispatch(s._id)).skipped).toBe('off')
    await setMode('on')
    await parcel({ type: 'p2p', payment_status: 'unpaid' })
    expect(await dispatch.sweepUndispatched()).toBe(1) // only the paid agency parcel
    expect(await DeliveryAssignment.countDocuments({ shipment_id: s._id })).toBe(1)
  })

  it('moves to the next rider on reject and on timeout, never re-offering the same rider', async () => {
    await setMode('on')
    const s = await parcel()
    const first = await dispatch.autoDispatch(s._id)
    await request(app).post(`/api/v1/riders/me/offers/${first.assignment_id}/reject`).set(authHeader(signToken(near))).send({ reason: 'Flat tyre' }).expect(200)
    const second = await DeliveryAssignment.findOne({ shipment_id: s._id, active: true })
    expect(second.rider_id.toString()).not.toBe(near._id.toString())

    await DeliveryAssignment.updateOne({ _id: second._id }, { $set: { expires_at: new Date(Date.now() - 1000) } })
    await dispatch.expireDueOffers()
    expect((await DeliveryAssignment.findById(second._id)).status).toBe('expired')
    const third = await DeliveryAssignment.findOne({ shipment_id: s._id, active: true })
    expect([near._id, second.rider_id].map(String)).not.toContain(third.rider_id.toString())
  })
})

describe('Manual assignment and the one-rider rule', () => {
  it('lets two simultaneous offers through only once', async () => {
    const s = await parcel()
    const [a, b] = await Promise.all([
      dispatch.manualOffer({ shipmentId: s._id, agencyId: firm._id, riderProfileId: (await RiderProfile.findOne({ user_id: near._id }))._id, actorId: owner._id }).then(() => 'ok', (e) => e.status),
      dispatch.manualOffer({ shipmentId: s._id, agencyId: firm._id, riderProfileId: (await RiderProfile.findOne({ user_id: far._id }))._id, actorId: owner._id }).then(() => 'ok', (e) => e.status),
    ])
    expect([a, b].sort()).toEqual([409, 'ok'])
    expect(await DeliveryAssignment.countDocuments({ shipment_id: s._id, active: true })).toBe(1)
  })

  it('cannot offer another agency’s rider, and lists ranked riders for the agency', async () => {
    const s = await parcel()
    const outsiderProfile = await RiderProfile.findOne({ user_id: outsider._id })
    const bad = await request(app).post(`/api/v1/logistics/shipments/${s._id}/assign`).set(authHeader(signToken(owner))).send({ rider_id: outsiderProfile._id })
    expect(bad.status).toBe(404)
    const view = await request(app).get(`/api/v1/logistics/shipments/${s._id}/assignment`).set(authHeader(signToken(owner)))
    expect(view.body.data.riders[0]).toMatchObject({ name: 'Near Rider', rank: 1, eligible: true })
    expect(view.body.data.riders.map((r) => r.name)).not.toContain('Other Agency Rider')
  })
})

describe('Rider delivery steps', () => {
  it('accept → pickup → delivered with cash collected, then the rider is free again', async () => {
    const s = await parcel({ payment_status: 'unpaid', agency_package: { payer: 'recipient', payment_arrangement: 'pay_on_delivery', amount_due_on_delivery: 1500, fee_source: 'district' } })
    const profile = await RiderProfile.findOne({ user_id: near._id })
    const offered = await request(app).post(`/api/v1/logistics/shipments/${s._id}/assign`).set(authHeader(signToken(owner))).send({ rider_id: profile._id })
    expect(offered.status).toBe(201)
    const auth = authHeader(signToken(near))

    const mine = await request(app).get('/api/v1/riders/me/deliveries').set(auth)
    expect(mine.body.data.offers[0].shipment).toMatchObject({ tracking_code: s.tracking_code, cash_to_collect: 1500 })

    await request(app).post(`/api/v1/riders/me/offers/${offered.body.data.assignment._id}/accept`).set(auth).expect(200)
    let after = await Shipment.findById(s._id).lean()
    expect(after).toMatchObject({ status: 'assigned' })
    expect(after.rider_id.toString()).toBe(near._id.toString())
    expect((await RiderProfile.findOne({ user_id: near._id })).availability).toBe('busy')

    // A rider cannot cancel, and another rider cannot touch this delivery.
    expect((await request(app).post(`/api/v1/riders/me/deliveries/${s._id}/status`).set(auth).send({ status: 'cancelled' })).status).toBe(400)
    expect((await request(app).post(`/api/v1/riders/me/deliveries/${s._id}/status`).set(authHeader(signToken(far))).send({ status: 'picked_up' })).status).toBe(403)

    await request(app).post(`/api/v1/riders/me/deliveries/${s._id}/status`).set(auth).send({ status: 'picked_up', note: 'Collected' }).expect(200)
    await request(app).post(`/api/v1/riders/me/deliveries/${s._id}/status`).set(auth).send({ status: 'delivered', note: 'Handed to Jean', cash_collected: 1500 }).expect(200)

    after = await Shipment.findById(s._id).lean()
    expect(after).toMatchObject({ status: 'delivered', payment_status: 'paid', agency_package: { collected_amount: 1500 } })
    expect(after.agency_package.collected_by.toString()).toBe(near._id.toString())
    const done = await waitFor(async () => { const a = await DeliveryAssignment.findOne({ shipment_id: s._id, status: 'completed' }); return a })
    expect(done.active).toBe(false)
    expect((await waitFor(async () => { const p = await RiderProfile.findOne({ user_id: near._id }); return p.availability === 'online' && p }))?.availability).toBe('online')
  })
})

describe('Proximity from live positions', () => {
  const LogisticZone = require('../../models/LogisticZone.model')
  const report = (user, body) => request(app).post('/api/v1/riders/me/location').set(authHeader(signToken(user))).send(body)

  it('without a pickup pin, ranks riders by distance to the pickup quartier centre', async () => {
    await LogisticZone.create({ name: 'Akwa', type: 'quartier', level: 3, centroid: { type: 'Point', coordinates: [9.6966, 4.0483] } })
    const s = await parcel({ pickup_address: { quartier: 'akwa', city: 'Douala' } })
    const [first] = await dispatch.rankRiders(s.toObject())
    expect(first.profile.user_id._id.toString()).toBe(near._id.toString())
    expect(first.reason).toMatch(/^~0\.\d km from pickup \(quartier centre\)$/)
  })

  it('online riders report their position while auto dispatch is on, and going offline forgets it', async () => {
    const fresh = await rider(firm, 'Fresh Rider')
    expect((await report(fresh, { lat: 4.05, lng: 9.70 })).status).toBe(403) // dispatch off, live tracking off
    await setMode('on')
    expect((await report(fresh, { lat: 4.05, lng: 9.70 })).body.data.stored).toBe(true)
    expect((await RiderProfile.findOne({ user_id: fresh._id }).lean()).last_location.lat).toBe(4.05)

    await request(app).patch('/api/v1/riders/me/availability').set(authHeader(signToken(fresh))).send({ availability: 'offline' })
    expect((await RiderProfile.findOne({ user_id: fresh._id }).lean()).last_location).toBeUndefined()
    expect((await report(fresh, { lat: 4.05, lng: 9.70 })).status).toBe(409) // offline and no delivery
  })

  it('a rider coming online picks up a waiting delivery straight away', async () => {
    await setMode('on')
    await RiderProfile.updateMany({}, { $set: { availability: 'offline' } })
    const s = await parcel()
    await request(app).patch('/api/v1/riders/me/availability').set(authHeader(signToken(far))).send({ availability: 'online' })
    const offered = await waitFor(() => DeliveryAssignment.findOne({ shipment_id: s._id, status: 'offered' }).lean())
    expect(offered.rider_id.toString()).toBe(far._id.toString())
  })
})
