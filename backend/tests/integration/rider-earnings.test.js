'use strict'
/**
 * Rider day, earnings, history and agency payouts.
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
beforeAll(() => { app = buildApp() })

let owner, firm, riderUser, profile
const ownerAuth = () => authHeader(signToken(owner))
const riderAuth = () => authHeader(signToken(riderUser))

// A job the rider accepted, then ended with `status` (delivered / failed).
const job = async (price, status) => {
  const s = await Shipment.create({
    type: 'p2p', logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, status: 'out_for_delivery', price, payment_status: 'paid', rider_id: riderUser._id,
    pickup_address: { quartier: 'Akwa', city: 'Douala' }, delivery_address: { quartier: 'Bonamoussadi', city: 'Douala' },
    other_party: { name: 'Jean', phone: '699987654' }, package_details: { category: 'clothing', weight_tier: 'light', description: 'Shoes' },
  })
  await DeliveryAssignment.create({ shipment_id: s._id, agency_id: firm._id, rider_id: riderUser._id, status: 'accepted', mode: 'auto', expires_at: new Date(Date.now() + 60000), responded_at: new Date() })
  await dispatch.settleAfterStatus(s._id, status)
  return s
}

beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true } }])
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  riderUser = await createUser({ name: 'Paul Rider' })
  profile = await RiderProfile.create({ user_id: riderUser._id, agency_id: firm._id, status: 'active', availability: 'online' })
})

it('pays riders by the agency rate in force when each job ends', async () => {
  expect((await request(app).patch('/api/v1/logistics/rider-pay').set(ownerAuth()).send({ mode: 'percent', value: 150 })).status).toBe(400)
  await job(2000, 'delivered') // no rate yet: not counted
  expect((await request(app).patch('/api/v1/logistics/rider-pay').set(ownerAuth()).send({ mode: 'percent', value: 40 })).body.data.rider_pay).toEqual({ mode: 'percent', value: 40 })
  await job(1500, 'delivered') // 600
  await request(app).patch('/api/v1/logistics/rider-pay').set(ownerAuth()).send({ mode: 'fixed', value: 500 })
  await job(3000, 'delivered') // 500
  await job(2500, 'failed')    // 0

  const sum = await request(app).get('/api/v1/riders/me/summary').set(riderAuth())
  expect(sum.body.data).toMatchObject({
    pay_rule: { mode: 'fixed', value: 500 },
    today: { delivered: 3, failed: 1, earned: 1100 },
    earnings: { earned: 1100, paid: 0, owed: 1100 },
  })
})

it('lists finished jobs newest first with filters and paging', async () => {
  await request(app).patch('/api/v1/logistics/rider-pay').set(ownerAuth()).send({ mode: 'fixed', value: 300 })
  for (let i = 0; i < 22; i++) await job(1000, 'delivered')
  await job(1000, 'failed')
  const first = await request(app).get('/api/v1/riders/me/history').set(riderAuth())
  expect(first.body.data.items).toHaveLength(20)
  expect(first.body.data.has_more).toBe(true)
  expect(first.body.data.items[0]).toMatchObject({ outcome: 'failed', from: 'Akwa', to: 'Bonamoussadi', earned: 0 })
  const next = await request(app).get('/api/v1/riders/me/history').query({ before: first.body.data.items[19].id }).set(riderAuth())
  expect(next.body.data.items).toHaveLength(3)
  expect(next.body.data.has_more).toBe(false)
  const failed = await request(app).get('/api/v1/riders/me/history').query({ outcome: 'failed' }).set(riderAuth())
  expect(failed.body.data.items).toHaveLength(1)
  const future = await request(app).get('/api/v1/riders/me/history').query({ from: '2099-01-01' }).set(riderAuth())
  expect(future.body.data.items).toHaveLength(0)
})

it('lets the agency record paying a rider, never more than it owes', async () => {
  await request(app).patch('/api/v1/logistics/rider-pay').set(ownerAuth()).send({ mode: 'fixed', value: 700 })
  await job(2000, 'delivered'); await job(2000, 'delivered') // owes 1400
  const list = await request(app).get('/api/v1/logistics/riders').set(ownerAuth())
  expect(list.body.data.riders[0].pay).toMatchObject({ earned: 1400, owed: 1400 })
  expect(list.body.data.counts.pay_owed).toBe(1400)
  expect((await request(app).post(`/api/v1/logistics/riders/${profile._id}/payouts`).set(ownerAuth()).send({ amount: 2000 })).status).toBe(400)
  expect((await request(app).post(`/api/v1/logistics/riders/${profile._id}/payouts`).set(ownerAuth()).send({ amount: 1000 })).body.data.owed).toBe(400)
  const sum = await request(app).get('/api/v1/riders/me/summary').set(riderAuth())
  expect(sum.body.data.earnings).toMatchObject({ earned: 1400, paid: 1000, owed: 400 })
  expect((await request(app).get('/api/v1/riders/me/summary').set(authHeader(signToken(await createUser())))).status).toBe(403)
})
