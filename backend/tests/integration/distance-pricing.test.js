'use strict'
/**
 * Distance-based delivery pricing: agencies choose district or distance mode;
 * distance = base + per km (min/max, rounded up), cross-city by city-pair price or
 * the cross-city per-km rate. Used by checkout, orders, shipments, P2P and packages.
 */
const request = require('supertest')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createLogisticsUser, createVendor } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const LogisticZone = require('../../models/LogisticZone.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Vendor = require('../../models/Vendor.model')
const Order = require('../../models/Order.model')
const logistics = require('../../services/logistics.service')
const { priceDelivery } = require('../../services/pricing.service')
const { metres } = require('../../services/routing.service')

let app
beforeAll(() => { app = buildApp() })
afterEach(() => { vi.restoreAllMocks(); process.env.ORS_API_KEY = '' })

// Straight line × 1.3 (no routing key in tests), as the service computes it.
const roadKm = (a, b) => Math.round((metres(a, b) * 1.3) / 100) / 10
const up50 = (n) => Math.ceil(n / 50) * 50

const ETOUG_EBE = { lat: 3.8521, lng: 11.4759 }
const SIMBOCK = { lat: 3.8099, lng: 11.4762 }
const AKWA = { lat: 4.0483, lng: 9.6966 }

let owner, firm, yaounde, douala, simbock, etougEbe, akwa
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { agency_packages: true } }])
  yaounde = await LogisticZone.create({ name: 'Yaoundé', type: 'city', level: 0 })
  douala = await LogisticZone.create({ name: 'Douala', type: 'city', level: 0 })
  const q = (name, city, p) => LogisticZone.create({ name, type: 'quartier', level: 1, parent_id: city._id, ancestors: [city._id], centroid: { type: 'Point', coordinates: [p.lng, p.lat] } })
  simbock = await q('Simbock', yaounde, SIMBOCK)
  etougEbe = await q('Etoug-Ebe', yaounde, ETOUG_EBE)
  akwa = await q('Akwa', douala, AKWA)
  owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'Aura Deliveries', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099',
    service_regions: ['Yaoundé'], vehicle_types: ['motorcycle'], is_verified: true,
    quartier_prices: [{ quartier: 'Simbock', price: 1000, zone_id: simbock._id }],
    pricing: { mode: 'distance', base_fee: 500, per_km: 150, min_fee: 700, max_fee: 0, round_to: 50,
      cross_city: { enabled: true, base_fee: 2000, per_km: 20, min_fee: 3000, max_fee: 0, city_pairs: [{ from_city: 'Douala', to_city: 'Yaounde', price: 4000 }] } } })
})

const auth = () => authHeader(signToken(owner))

describe('priceDelivery', () => {
  it('charges base + per km within a city, rounded up, never below the minimum', async () => {
    const q = await priceDelivery(firm, { pickup: { zone_id: etougEbe._id, location: ETOUG_EBE }, dropoff: { zone_id: simbock._id, location: SIMBOCK } })
    const km = roadKm(ETOUG_EBE, SIMBOCK)
    expect(q).toMatchObject({ rule: 'within_city', cross_city: false, distance_km: km, approx: true, fee: up50(Math.max(700, 500 + 150 * km)) })
    // Same spot: the minimum applies.
    expect((await priceDelivery(firm, { pickup: { zone_id: simbock._id }, dropoff: { zone_id: simbock._id } })).fee).toBe(700)
  })

  it('caps at the maximum when one is set', async () => {
    firm.pricing.max_fee = 800
    const q = await priceDelivery(firm, { pickup: { zone_id: etougEbe._id, location: ETOUG_EBE }, dropoff: { zone_id: simbock._id, location: SIMBOCK } })
    expect(q.fee).toBe(800)
  })

  it('uses the city-pair price in either direction (accents ignored), else the cross-city rate', async () => {
    const there = await priceDelivery(firm, { pickup: { zone_id: akwa._id }, dropoff: { zone_id: simbock._id } })
    const back = await priceDelivery(firm, { pickup: { zone_id: simbock._id }, dropoff: { zone_id: akwa._id } })
    expect(there).toMatchObject({ rule: 'city_pair', cross_city: true, fee: 4000, from_city: 'Douala', to_city: 'Yaoundé' })
    expect(back.fee).toBe(4000)

    firm.pricing.cross_city.city_pairs = []
    const km = roadKm(AKWA, SIMBOCK)
    const rated = await priceDelivery(firm, { pickup: { zone_id: akwa._id }, dropoff: { zone_id: simbock._id } })
    expect(rated).toMatchObject({ rule: 'cross_city_km', fee: up50(Math.max(3000, 2000 + 20 * km)) })
  })

  it('refuses cross-city trips when the agency has them off, and cities it does not serve', async () => {
    firm.pricing.cross_city.enabled = false
    expect((await priceDelivery(firm, { pickup: { zone_id: akwa._id }, dropoff: { zone_id: simbock._id } })).error).toMatch(/does not deliver from Douala to Yaoundé/)
    const doualaOnly = await priceDelivery(firm, { pickup: { zone_id: akwa._id }, dropoff: { zone_id: akwa._id } })
    expect(doualaOnly.error).toMatch(/does not deliver in Douala/)
  })

  it('uses the road distance from the routing service when a key is set, once per trip', async () => {
    process.env.ORS_API_KEY = 'test-key'
    const ors = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [] }, properties: { summary: { distance: 6420, duration: 900 }, segments: [] } }] }) })
    const trip = { pickup: { location: { lat: 3.85, lng: 11.47 } }, dropoff: { location: { lat: 3.81, lng: 11.48 } } }
    const q = await priceDelivery(firm, trip)
    expect(q).toMatchObject({ distance_km: 6.4, approx: false, fee: up50(500 + 150 * 6.4) })
    await priceDelivery(firm, trip)
    expect(ors).toHaveBeenCalledTimes(1)
  })
})

describe('Agency pricing rules', () => {
  it('reads, saves and validates the rules; district stays the default', async () => {
    const fresh = await createLogisticsUser()
    await LogisticsCompany.create({ user_id: fresh._id, company_name: 'New', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000098' })
    const def = await request(app).get('/api/v1/logistics/pricing/rules').set(authHeader(signToken(fresh)))
    expect(def.body.data.pricing.mode).toBe('district')

    const bad = await request(app).patch('/api/v1/logistics/pricing/rules').set(auth()).send({ pricing: { min_fee: 1000, max_fee: 500 } })
    expect(bad.status).toBe(400)
    const pairs = await request(app).patch('/api/v1/logistics/pricing/rules').set(auth()).send({ pricing: { cross_city: { city_pairs: [{ from_city: 'Douala', to_city: 'Douala', price: 1 }] } } })
    expect(pairs.status).toBe(400)

    const ok = await request(app).patch('/api/v1/logistics/pricing/rules').set(auth())
      .send({ pricing: { per_km: 200, cross_city: { city_pairs: [{ from_city: 'Yaoundé', to_city: 'Bafoussam', price: 3500 }] } }, service_regions: ['Yaoundé', 'Douala'] })
    expect(ok.status).toBe(200)
    const saved = (await LogisticsCompany.findById(firm._id).lean())
    expect(saved.pricing).toMatchObject({ mode: 'distance', per_km: 200, base_fee: 500, cross_city: { enabled: true, city_pairs: [{ from_city: 'Yaoundé', to_city: 'Bafoussam', price: 3500 }] } })
    expect(saved.service_regions).toEqual(['Yaoundé', 'Douala'])
    expect(saved.quartier_prices).toHaveLength(1) // the quartier list is untouched
  })

  it('previews a trip with unsaved changes', async () => {
    const res = await request(app).post('/api/v1/logistics/pricing/preview').set(auth())
      .send({ pickup: { zone_id: etougEbe._id }, dropoff: { zone_id: simbock._id }, pricing: { base_fee: 0, per_km: 100, min_fee: 0, round_to: 100 } })
    expect(res.status).toBe(200)
    expect(res.body.data.fee).toBe(Math.ceil((100 * roadKm(ETOUG_EBE, SIMBOCK)) / 100) * 100)
    expect((await LogisticsCompany.findById(firm._id).lean()).pricing.per_km).toBe(150) // not saved
  })
})

describe('Checkout and orders', () => {
  let vendor
  beforeEach(async () => {
    ({ vendor } = await createVendor())
    await Vendor.updateOne({ _id: vendor._id }, { $set: { pickup_address: { city: 'Yaoundé', quartier: 'Etoug-Ebe', zone_id: etougEbe._id, location: { ...ETOUG_EBE, source: 'search' } } } })
  })

  it('offers distance-priced agencies with a quote for the exact spot', async () => {
    const res = await request(app).get('/api/v1/logistics/compatible-firms')
      .query({ vendor_ids: vendor._id.toString(), quartier: 'Simbock', zone_id: simbock._id.toString(), lat: SIMBOCK.lat, lng: SIMBOCK.lng })
    const f = res.body.data.firms.find((x) => x.company_name === 'Aura Deliveries')
    const fee = up50(Math.max(700, 500 + 150 * roadKm(ETOUG_EBE, SIMBOCK)))
    expect(f).toMatchObject({ pricing_mode: 'distance', fee_estimate: fee, total_fee_estimate: fee })
    expect(f.distance_quotes[0]).toMatchObject({ cross_city: false, distance_km: roadKm(ETOUG_EBE, SIMBOCK) })
  })

  it('leaves out an agency that does not serve the customer’s city', async () => {
    firm.pricing.cross_city.enabled = false
    await firm.save()
    const firms = await logistics.getCompatibleFirms('Akwa', [vendor._id])
    expect(firms.map((f) => f.company_name)).not.toContain('Aura Deliveries')
    expect((await logistics.getCompatibleFirms('Simbock', [vendor._id])).map((f) => f.company_name)).toContain('Aura Deliveries')
  })

  it('prices the order per vendor and keeps the charged fee on the shipment', async () => {
    const fees = await logistics.calculateShipmentFees([vendor._id], 'Simbock', firm._id, { dropoff: { zone_id: simbock._id, location: SIMBOCK } })
    const fee = up50(Math.max(700, 500 + 150 * roadKm(ETOUG_EBE, SIMBOCK)))
    expect(fees).toMatchObject({ totalFee: fee, perShipmentFee: fee })

    const order = await Order.create({ customer_id: new mongoose.Types.ObjectId(), vendor_id: vendor._id, products: [{ product_id: new mongoose.Types.ObjectId(), vendor_id: vendor._id, name: 'Shoes', price: 5000, regular_price: 5000, quantity: 1 }],
      subtotal: 5000, shipping_fee: 1234, total_amount: 6234, payment_method: 'wallet', shipping_method: 'logistics_partner', logistics_company_id: firm._id,
      shipping_address: { city: 'Yaoundé', quartier: 'Simbock', zone_id: simbock._id, location: { ...SIMBOCK, source: 'search' } } })
    const [shipment] = await logistics.createShipmentsForOrder(order, 'Simbock', firm._id)
    expect(shipment.price).toBe(1234) // what the customer paid, even if the road distance changes later
  })

  it('leaves district-priced agencies exactly as before', async () => {
    firm.pricing.mode = 'district'
    await firm.save()
    expect(await logistics.calculateShipmentFees([vendor._id], 'Simbock', firm._id, { dropoff: { location: SIMBOCK } })).toEqual({ perShipmentFee: 1000, totalFee: 1000 })
  })
})

describe('Agency packages', () => {
  it('prices a package by distance and records the source', async () => {
    const res = await request(app).post('/api/v1/logistics/packages').set(auth()).send({
      description: 'Box', category: 'other', sender: { name: 'A', phone: '677123456' }, recipient: { name: 'B', phone: '699987654' },
      pickup: { zone_id: etougEbe._id, location: { ...ETOUG_EBE, source: 'pin' } }, delivery: { zone_id: simbock._id, location: { ...SIMBOCK, source: 'search' } },
    })
    expect(res.status).toBe(201)
    expect(res.body.data.shipment).toMatchObject({ price: up50(Math.max(700, 500 + 150 * roadKm(ETOUG_EBE, SIMBOCK))), agency_package: { fee_source: 'distance' } })
  })
})
