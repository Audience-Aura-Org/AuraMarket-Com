'use strict'
/**
 * Exact spots (place search / map pin) on saved addresses, vendor pickup
 * addresses, orders and the shipments riders get; place search results merged
 * with our own quartiers.
 */
const request = require('supertest')
const mongoose = require('mongoose')
const { buildApp } = require('../setup/app')
const { createUser, createVendor } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const User = require('../../models/User.model')
const Vendor = require('../../models/Vendor.model')
const Order = require('../../models/Order.model')
const LogisticZone = require('../../models/LogisticZone.model')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const logistics = require('../../services/logistics.service')

let app
beforeAll(() => { app = buildApp() })
afterEach(() => { vi.restoreAllMocks(); delete process.env.ORS_API_KEY })

const SPOT = { lat: 3.8099, lng: 11.4762, source: 'search' }

it('saves an exact spot on a customer address, and refuses points outside Cameroon', async () => {
  const u = await createUser()
  const auth = authHeader(signToken(u))
  await request(app).post('/api/v1/addresses').set(auth).send({ label: 'Home', city: 'Yaoundé', quartier: 'Simbock', place_name: 'Tradex Simbock', location: SPOT })
  let addr = (await User.findById(u._id).lean()).addresses[0]
  expect(addr).toMatchObject({ place_name: 'Tradex Simbock', location: { lat: 3.8099, lng: 11.4762, source: 'search' } })
  await request(app).patch(`/api/v1/addresses/${addr._id}`).set(auth).send({ location: { lat: 48.85, lng: 2.35 } }) // Paris
  addr = (await User.findById(u._id).lean()).addresses[0]
  expect(addr.location?.lat ?? null).toBeNull()
})

it('keeps the vendor pickup zone and exact spot when the store address is saved', async () => {
  const { user, vendor } = await createVendor()
  const zone = new mongoose.Types.ObjectId()
  await Vendor.updateOne({ _id: vendor._id }, { $set: { 'pickup_address.zone_id': zone } })
  const r = await request(app).patch('/api/v1/vendors/profile').set(authHeader(signToken(user)))
    .send({ pickup_address: { city: 'Yaoundé', quartier: 'Etoug-Ebe I', address_description: 'Next to the pharmacy', place_name: 'Carrefour Etoug-Ebe', location: { lat: 3.8521, lng: 11.4759, source: 'search' } } })
  expect(r.status).toBeLessThan(300)
  const v = await Vendor.findById(vendor._id).lean()
  expect(v.pickup_address.zone_id.toString()).toBe(zone.toString()) // used to be dropped on every save
  expect(v.pickup_address).toMatchObject({ place_name: 'Carrefour Etoug-Ebe', location: { lat: 3.8521, lng: 11.4759 } })
})

it('carries the vendor and customer spots onto the shipment riders get', async () => {
  const { vendor } = await createVendor()
  await Vendor.updateOne({ _id: vendor._id }, { $set: { pickup_address: { city: 'Yaoundé', quartier: 'Etoug-Ebe I', location: { lat: 3.8521, lng: 11.4759, source: 'search' } } } })
  const firm = await LogisticsCompany.create({ user_id: new mongoose.Types.ObjectId(), company_name: 'Aura Deliveries', contact_email: 'ops@x.cm', contact_phone: '+237600000099', service_regions: ['Yaoundé'], vehicle_types: ['motorcycle'], quartier_prices: [{ quartier: 'Simbock', price: 1000 }] })
  const order = await Order.create({ customer_id: new mongoose.Types.ObjectId(), vendor_id: vendor._id, products: [{ product_id: new mongoose.Types.ObjectId(), vendor_id: vendor._id, name: 'Shoes', price: 5000, regular_price: 5000, quantity: 1 }], subtotal: 5000, total_amount: 6000, payment_method: 'wallet',
    shipping_method: 'logistics_partner', logistics_company_id: firm._id,
    shipping_address: { city: 'Yaoundé', quartier: 'Simbock', place_name: 'Tradex Simbock', location: SPOT } })
  expect((await Order.findById(order._id).lean()).shipping_address.location).toMatchObject({ lat: 3.8099, lng: 11.4762 })
  const [shipment] = await logistics.createShipmentsForOrder(order, 'Simbock', firm._id)
  expect(shipment.pickup_address.location).toMatchObject({ lat: 3.8521, lng: 11.4759 })
  expect(shipment.delivery_address.location).toMatchObject({ lat: 3.8099, lng: 11.4762 })
})

it('merges streets and landmarks from the place search after our quartiers', async () => {
  await LogisticZone.create({ name: 'Simbock', type: 'quartier', level: 3, centroid: { type: 'Point', coordinates: [11.4762, 3.8099] } })
  process.env.ORS_API_KEY = 'test-key'
  const ors = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ features: [
    { properties: { layer: 'venue', gid: 'osm:1', name: 'Tradex Simbock', locality: 'Yaoundé' }, geometry: { coordinates: [11.4771, 3.8102] } },
    { properties: { layer: 'venue', gid: 'osm:2', name: 'Simbock', locality: 'Yaoundé' }, geometry: { coordinates: [11.47, 3.81] } }, // same name as our quartier: skipped
  ] }) })
  const r = await request(app).get('/api/v1/locations/search').query({ q: 'simbock' })
  const names = r.body.data.results.map((x) => `${x.name}:${x.zone_id ? 'zone' : 'point'}`)
  expect(names).toEqual(['Simbock:zone', 'Tradex Simbock:point'])
  await request(app).get('/api/v1/locations/search').query({ q: 'simbock' })
  expect(ors).toHaveBeenCalledTimes(1) // cached for the day
})

describe('Saved addresses (up to 5, saved when used)', () => {
  const { rememberAddress } = require('../../services/savedAddress.service')
  const spot = (lat, lng) => ({ lat, lng, source: 'search' })

  it('saves a new place, refreshes the same place, and adds a pin it was missing', async () => {
    const u = await createUser()
    await rememberAddress(u._id, { quartier: 'Simbock', city: 'Yaoundé', landmark: 'Blue gate' })
    await rememberAddress(u._id, { quartier: 'Simbock', city: 'Yaoundé', landmark: 'Blue gate', location: spot(3.8099, 11.4762) })
    await rememberAddress(u._id, { quartier: 'Simbock', place_name: 'Tradex Simbock', location: spot(3.81, 11.4763) }) // ~20 m away: same place
    const addrs = (await User.findById(u._id).lean()).addresses
    expect(addrs).toHaveLength(1)
    expect(addrs[0]).toMatchObject({ quartier: 'Simbock', landmark_description: 'Blue gate', place_name: 'Tradex Simbock', isDefault: true, location: { lat: 3.8099 } })
  })

  it('keeps at most 5: the least recently used non-default address makes room', async () => {
    const u = await createUser()
    for (let i = 0; i < 5; i++) await rememberAddress(u._id, { quartier: `Q${i}`, location: spot(3.80 + i * 0.01, 11.47) })
    await rememberAddress(u._id, { quartier: 'Q1', location: spot(3.81, 11.47) }) // used again: now the most recent
    await rememberAddress(u._id, { quartier: 'Q5', location: spot(3.90, 11.47) })
    const names = (await User.findById(u._id).lean()).addresses.map((a) => a.quartier).sort()
    expect(names).toEqual(['Q0', 'Q1', 'Q3', 'Q4', 'Q5']) // Q0 is the default; Q2 was the least recently used
  })

  it('refuses a sixth address added by hand and lists the default first, then the latest used', async () => {
    const u = await createUser()
    const auth = authHeader(signToken(u))
    for (let i = 0; i < 5; i++) await rememberAddress(u._id, { quartier: `Q${i}`, location: spot(3.80 + i * 0.01, 11.47) })
    const full = await request(app).post('/api/v1/addresses').set(auth).send({ quartier: 'Extra', location: spot(3.95, 11.47) })
    expect(full.status).toBe(400)
    expect(full.body.message).toMatch(/up to 5/)
    const list = await request(app).get('/api/v1/addresses').set(auth)
    expect(list.body.data.addresses.map((a) => a.quartier)).toEqual(['Q0', 'Q4', 'Q3', 'Q2', 'Q1'])
    expect(list.body.data.max).toBe(5)
  })
})
