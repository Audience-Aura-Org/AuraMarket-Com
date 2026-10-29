'use strict'
/**
 * Phase 9: rider performance report for agencies, and the admin live map.
 */
const request = require('supertest')
const crypto = require('crypto')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser, createAdmin } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Shipment = require('../../models/Shipment.model')
const RiderProfile = require('../../models/RiderProfile.model')
const DeliveryAssignment = require('../../models/DeliveryAssignment.model')
const LogisticZone = require('../../models/LogisticZone.model')

let app
beforeAll(() => { app = buildApp() })

let owner, firm, paul, grace
const ago = (min) => new Date(Date.now() - min * 60000)
const ship = (extra = {}) => Shipment.create({
  type: 'p2p', logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, status: 'assigned', price: 1500, payment_status: 'paid',
  pickup_address: { quartier: 'Akwa', city: 'Douala', location: { lat: 4.0483, lng: 9.6966 } }, delivery_address: { quartier: 'Bonamoussadi', city: 'Douala' },
  other_party: { name: 'Jean', phone: '699987654' }, package_details: { category: 'clothing', weight_tier: 'light', description: 'Shoes' }, ...extra,
})
const offer = (s, rider, status, { offered = 60, responded = null, completed = null, mode = 'auto' } = {}) => DeliveryAssignment.create({
  shipment_id: s._id, agency_id: firm._id, rider_id: rider._id, status, mode, active: status === 'accepted' || status === 'offered',
  offered_at: ago(offered), expires_at: ago(offered - 2), responded_at: responded == null ? null : ago(responded), completed_at: completed == null ? null : ago(completed),
})

beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true } }])
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  paul = await createUser({ name: 'Paul Rider' }); grace = await createUser({ name: 'Grace Rider' })
  await RiderProfile.create({ user_id: paul._id, agency_id: firm._id, status: 'active', availability: 'busy', last_location: { lat: 4.05, lng: 9.70, at: new Date() } })
  await RiderProfile.create({ user_id: grace._id, agency_id: firm._id, status: 'active', availability: 'offline' })
})

describe('Rider report', () => {
  it('counts offers, answers and timings per rider and for dispatch overall', async () => {
    const a = await ship({ status: 'delivered' }); const b = await ship()
    await offer(a, grace, 'expired', { offered: 120 })
    await offer(a, paul, 'completed', { offered: 100, responded: 99, completed: 79 }) // answered in 60 s, delivered in 20 min
    await offer(b, paul, 'rejected', { offered: 50, responded: 49.5 })
    await offer(b, grace, 'accepted', { offered: 40, responded: 39, mode: 'manual' })

    const r = await request(app).get('/api/v1/logistics/riders/report').query({ days: 7 }).set(authHeader(signToken(owner)))
    expect(r.status).toBe(200)
    const p = r.body.data.riders.find((x) => x.name === 'Paul Rider')
    expect(p).toMatchObject({ offers: 2, accepted: 1, rejected: 1, missed: 0, completed: 1, acceptance_rate: 0.5, avg_delivery_minutes: 20 })
    expect(p.avg_response_seconds).toBe(45) // (60 + 30) / 2
    const g = r.body.data.riders.find((x) => x.name === 'Grace Rider')
    expect(g).toMatchObject({ offers: 2, accepted: 1, missed: 1, completed: 0 })
    expect(r.body.data.dispatch).toMatchObject({ deliveries_offered: 2, offers: 4, auto_share: 0.75, offers_per_delivery: 2, first_offer_success: 0 })
  })

  it('is only for agencies', async () => {
    expect((await request(app).get('/api/v1/logistics/riders/report').set(authHeader(signToken(paul)))).status).toBe(403)
  })
})

describe('Admin live map', () => {
  it('shows online riders with a fresh position and deliveries under way, using quartier centres without a pin', async () => {
    await LogisticZone.create({ name: 'Bonamoussadi', type: 'quartier', level: 3, centroid: { type: 'Point', coordinates: [9.7427, 4.0946] } })
    await ship({ rider_id: paul._id, status: 'out_for_delivery' })
    await ship({ status: 'delivered' })
    const admin = await createAdmin()
    const r = await request(app).get('/api/v1/admin/logistics/live-map').set(authHeader(signToken(admin)))
    expect(r.status).toBe(200)
    expect(r.body.data.riders.map((x) => x.name)).toEqual(['Paul Rider']) // Grace is offline
    expect(r.body.data.deliveries).toHaveLength(1)
    expect(r.body.data.deliveries[0]).toMatchObject({ status: 'out_for_delivery', has_rider: true, pickup: { approx: false }, dropoff: { lat: 4.0946, lng: 9.7427, approx: true } })
    expect((await request(app).get('/api/v1/admin/logistics/live-map').set(authHeader(signToken(owner)))).status).toBe(403)
  })
})
