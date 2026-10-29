'use strict'
/**
 * Phase 7: paying for a delivery offers it to a rider at once (flag
 * payment_triggered_dispatch), and agencies track the cash each rider carries.
 */
const request = require('supertest')
const crypto = require('crypto')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Shipment = require('../../models/Shipment.model')
const RiderProfile = require('../../models/RiderProfile.model')
const DeliveryAssignment = require('../../models/DeliveryAssignment.model')
const AgencySettlement = require('../../models/AgencySettlement.model')
const dispatch = require('../../services/riderDispatch.service')

let app
beforeAll(() => { app = buildApp() })

let owner, firm, riderUser, riderProfile
const flags = (features) => PlatformSettings.updateOne({}, { $set: { features: { rider_accounts: true, ...features } } })
const parcel = (extra = {}) => ({
  type: 'p2p', logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, status: 'assigned', price: 1500, payment_status: 'paid',
  pickup_address: { quartier: 'Akwa', city: 'Douala', location: { lat: 4.0483, lng: 9.6966 } }, delivery_address: { quartier: 'Bonamoussadi', city: 'Douala' },
  other_party: { name: 'Jean', phone: '699987654' }, package_details: { category: 'clothing', weight_tier: 'light', description: 'Shoes' },
  shipment_logs: [{ status: 'assigned', timestamp: new Date() }], ...extra,
})
const waitFor = async (fn, ms = 3000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 50)) } return v }

beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { rider_accounts: true } }])
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
  riderUser = await createUser({ name: 'Paul Rider' })
  riderProfile = await RiderProfile.create({ user_id: riderUser._id, agency_id: firm._id, status: 'active', availability: 'online', last_location: { lat: 4.049, lng: 9.697, at: new Date() } })
})

describe('Payment-triggered dispatch', () => {
  it('offers a paid delivery to the nearest rider straight away', async () => {
    await flags({ auto_rider_dispatch: 'on', payment_triggered_dispatch: true })
    const s = await Shipment.create(parcel())
    dispatch.dispatchAfterPayment({ _id: s._id })
    const offer = await waitFor(() => DeliveryAssignment.findOne({ shipment_id: s._id, status: 'offered' }).lean())
    expect(offer.rider_id.toString()).toBe(riderUser._id.toString())
  })

  it('waits for the payment transaction to finish, and does nothing if it rolls back', async () => {
    await flags({ auto_rider_dispatch: 'on', payment_triggered_dispatch: true })
    const session = await mongoose.startSession()
    let committedId
    await session.withTransaction(async () => {
      const [s] = await Shipment.create([parcel()], { session })
      committedId = s._id
      dispatch.dispatchAfterPayment({ _id: s._id }, { session })
      await new Promise((r) => setTimeout(r, 200))
      expect(await DeliveryAssignment.countDocuments()).toBe(0) // still inside the transaction
    })
    await session.endSession()
    expect(await waitFor(() => DeliveryAssignment.findOne({ shipment_id: committedId }).lean())).toBeTruthy()

    const aborted = await mongoose.startSession()
    aborted.startTransaction()
    const [gone] = await Shipment.create([parcel()], { session: aborted })
    dispatch.dispatchAfterPayment({ _id: gone._id }, { session: aborted })
    await aborted.abortTransaction()
    await aborted.endSession()
    await new Promise((r) => setTimeout(r, 300))
    expect(await DeliveryAssignment.countDocuments({ shipment_id: gone._id })).toBe(0)
  })

  it('leaves it to the sweep while the flag is off', async () => {
    await flags({ auto_rider_dispatch: 'on', payment_triggered_dispatch: false })
    const s = await Shipment.create(parcel())
    dispatch.dispatchAfterPayment({ _id: s._id })
    await new Promise((r) => setTimeout(r, 300))
    expect(await DeliveryAssignment.countDocuments({ shipment_id: s._id })).toBe(0)
  })
})

describe('Rider cash', () => {
  const ownerAuth = () => authHeader(signToken(owner))
  const seedCash = async () => {
    await Shipment.create(parcel({ type: 'agency', status: 'delivered', rider_id: riderUser._id,
      agency_package: { payment_arrangement: 'pay_on_delivery', amount_due_on_delivery: 5000, collected_amount: 5000, collected_by: riderUser._id, collected_at: new Date() } }))
    await AgencySettlement.create({ agency_id: firm._id, kind: 'collection', rider_id: riderUser._id, order_id: new mongoose.Types.ObjectId(), amount_collected: 12000, amount_due: 11000, reference: `COD-${crypto.randomBytes(4).toString('hex')}` })
  }

  it('shows what each rider holds and records handovers up to that amount', async () => {
    await seedCash()
    const list = await request(app).get('/api/v1/logistics/riders').set(ownerAuth())
    expect(list.body.data.riders[0].cash).toMatchObject({ collected: 17000, handed_over: 0, holding: 17000 })
    expect(list.body.data.counts.cash_holding).toBe(17000)

    const tooMuch = await request(app).post(`/api/v1/logistics/riders/${riderProfile._id}/cash-handovers`).set(ownerAuth()).send({ amount: 20000 })
    expect(tooMuch.status).toBe(400)
    const ok = await request(app).post(`/api/v1/logistics/riders/${riderProfile._id}/cash-handovers`).set(ownerAuth()).send({ amount: 7000, note: 'Evening drop' })
    expect(ok.status).toBe(201)
    expect(ok.body.data.cash).toMatchObject({ handed_over: 7000, holding: 10000 })

    const mine = await request(app).get('/api/v1/riders/me/deliveries').set(authHeader(signToken(riderUser)))
    expect(mine.body.data.cash_holding).toBe(10000)
  })

  it('does not let another agency record handovers for this rider', async () => {
    await seedCash()
    const other = await createLogisticsUser()
    await LogisticsCompany.create({ user_id: other._id, company_name: 'Other', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000098', service_regions: ['Douala'], vehicle_types: ['motorcycle'] })
    const r = await request(app).post(`/api/v1/logistics/riders/${riderProfile._id}/cash-handovers`).set(authHeader(signToken(other))).send({ amount: 1000 })
    expect(r.status).toBe(404)
  })
})
