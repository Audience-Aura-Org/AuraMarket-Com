'use strict'
/**
 * Phase 0 — public tracking privacy and the pay-on-delivery agency cash ledger.
 */
const request  = require('supertest')
const mongoose = require('mongoose')
const crypto   = require('crypto')
const { faker } = require('@faker-js/faker')

const { buildApp } = require('../setup/app')
const { createUser, createVendorUser, createLogisticsUser, createOrder } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Vendor           = require('../../models/Vendor.model')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const Shipment         = require('../../models/Shipment.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const AgencySettlement = require('../../models/AgencySettlement.model')
const { generateTrackingCode } = require('../../services/logistics.service')

let app
beforeAll(() => { app = buildApp() })

let logisticsUser, firm, vendorUser, vendorDoc, booker, admin
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', escrow_fee_type: 'percentage', escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false } }])
  logisticsUser = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: logisticsUser._id, company_name: 'FastShip Ltd', contact_email: faker.internet.email().toLowerCase(),
    contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'], is_verified: true })
  vendorUser = await createVendorUser({ verification_status: 'verified' })
  vendorDoc = await Vendor.create({ user_id: vendorUser._id, store_name: 'Mama Ngozi', description: 'x', phone: '677000000', verified: true })
  booker = await createUser({ name: 'Amina Fon', phone: '677123456' })
  admin = await createUser({ role: 'admin' })
})

const p2pShipment = () => Shipment.create({
  type: 'p2p', logistics_id: firm._id, tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
  status: 'in_transit', price: 1500, booked_by: booker._id, direction: 'send',
  pickup_address: { street: 'Rue 1.234', quartier: 'Akwa', city: 'Douala', phone: '677123456' },
  delivery_address: { street: 'Carrefour Bonamoussadi', quartier: 'Bonamoussadi', city: 'Douala', phone: '699987654' },
  other_party: { name: 'Jean Mbarga', phone: '699987654', email: 'jean@example.com' },
  package_details: { category: 'clothing', weight_tier: 'light', description: 'Two toghu jackets', declared_value: 50000 },
  proof_of_delivery: { image_url: 'https://cdn.test/door.jpg', timestamp: new Date() },
  shipment_logs: [{ status: 'in_transit', timestamp: new Date(), note: 'On the way' }],
})

describe('GET /p2p/track/:code — privacy', () => {
  it('shows progress but no personal data to an anonymous code holder', async () => {
    const s = await p2pShipment()
    const res = await request(app).get(`/api/v1/p2p/track/${s.tracking_code}`)
    expect(res.status).toBe(200)
    const out = res.body.data.shipment
    expect(out.status).toBe('in_transit')
    expect(out.shipment_logs).toHaveLength(1)
    expect(out.redacted).toBe(true)
    const json = JSON.stringify(out)
    for (const secret of ['677123456', '699987654', 'jean@example.com', 'Rue 1.234', 'Carrefour Bonamoussadi', 'Two toghu jackets', 'door.jpg', 'Mbarga', booker.email]) {
      expect(json).not.toContain(secret)
    }
    expect(out.other_party).toEqual({ name: 'Jean', phone: '6•• ••• 654' })
    expect(out.delivery_address.quartier).toBe('Bonamoussadi')
    expect(out.logistics_id).toEqual({ company_name: 'FastShip Ltd' })
  })

  it('shows the full record to the booker', async () => {
    const s = await p2pShipment()
    const res = await request(app).get(`/api/v1/p2p/track/${s.tracking_code}`).set(authHeader(signToken(booker)))
    expect(res.status).toBe(200)
    expect(res.body.data.shipment.redacted).toBeUndefined()
    expect(res.body.data.shipment.other_party.email).toBe('jean@example.com')
    expect(res.body.data.shipment.logistics_id.user_id).toBeUndefined()
  })

  it('generates unguessable 8-character tracking codes', async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => generateTrackingCode()))
    for (const code of codes) expect(code).toMatch(/^AURA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('Pay-on-delivery agency cash ledger', () => {
  const deliverCodOrder = async () => {
    const order = await createOrder({ customerId: booker._id, vendorId: vendorDoc._id, productId: new mongoose.Types.ObjectId() },
      { payment_method: 'pay_on_delivery', payment_status: 'pending', shipping_method: 'logistics_partner', logistics_company_id: firm._id,
        subtotal: 5_000, shipping_fee: 500, total_amount: 5_500 })
    const shipment = await Shipment.create({ order_id: order._id, vendor_id: vendorDoc._id, logistics_id: firm._id,
      tracking_code: `AURA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, price: 500, status: 'out_for_delivery', shipment_logs: [] })
    const res = await request(app).patch(`/api/v1/logistics/shipments/${shipment._id}/status`).set(authHeader(signToken(logisticsUser)))
      .send({ status: 'delivered', note: 'Handed over', proof_image: 'https://cdn.test/proof.jpg' })
    expect(res.status).toBe(200)
    return { order, shipment }
  }

  it('records that the agency owes the subtotal it collected in cash, once', async () => {
    const { order, shipment } = await deliverCodOrder()
    const entries = await AgencySettlement.find({ order_id: order._id })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ kind: 'collection', amount_collected: 5_500, amount_due: 5_000, status: 'outstanding' })
    expect(entries[0].agency_id.toString()).toBe(firm._id.toString())
    expect(entries[0].shipment_id.toString()).toBe(shipment._id.toString())
  })

  it('lets an admin see the balance and record a remittance, but never more than is owed', async () => {
    await deliverCodOrder()
    const auth = authHeader(signToken(admin))
    const list = await request(app).get('/api/v1/admin/agency-settlements').set(auth)
    expect(list.status).toBe(200)
    expect(list.body.data.total_outstanding).toBe(5_000)

    const tooMuch = await request(app).post(`/api/v1/admin/agency-settlements/${firm._id}/remittances`).set(auth).send({ amount: 6_000 })
    expect(tooMuch.status).toBe(400)

    const paid = await request(app).post(`/api/v1/admin/agency-settlements/${firm._id}/remittances`).set(auth).send({ amount: 3_000, note: 'Cash deposit' })
    expect(paid.status).toBe(201)
    expect(paid.body.data.outstanding).toBe(2_000)

    const ledger = await request(app).get(`/api/v1/admin/agency-settlements/${firm._id}`).set(auth)
    expect(ledger.body.data.summary).toMatchObject({ owed: 5_000, remitted: 3_000, outstanding: 2_000 })
    expect(ledger.body.data.entries).toHaveLength(2)
  })

  it('is admin-only', async () => {
    const res = await request(app).get('/api/v1/admin/agency-settlements').set(authHeader(signToken(logisticsUser)))
    expect([401, 403]).toContain(res.status)
  })
})
