'use strict'
/**
 * tests/integration/instant-buy-details.test.js
 * After paying in the Buy Now popup, the buyer sends name, phone and exact spot.
 */

const request = require('supertest')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser, createVendor, createOrder, createProductForVendor } = require('../factories')
const { asUser } = require('../helpers/auth')

const Order = require('../../models/Order.model')
const User = require('../../models/User.model')
const Shipment = require('../../models/Shipment.model')
const Notification = require('../../models/Notification.model')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

let buyer, vendor, vendorUser, firm
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { instant_buy: true } }])
  buyer = await createUser()
  ;({ user: vendorUser, vendor } = await createVendor())
  const owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'], quartier_prices: [{ quartier: 'Akwa', price: 1000 }] })
})

const paidPopupOrder = (overrides = {}) => createOrder({ customerId: buyer._id, vendorId: vendor._id }, {
  payment_method: 'pawapay',
  payment_status: 'paid',
  shipping_method: 'logistics_partner',
  logistics_company_id: firm._id,
  shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456' },
  delivery_details_status: 'pending',
  rider_dispatch_at: new Date(Date.now() + 30 * 60 * 1000),
  ...overrides,
})

const details = { full_name: 'Marie Ngo', phone: '699112233', landmark: 'Blue gate next to the pharmacy', location: { lat: 4.0483, lng: 9.6966, source: 'pin' }, place_name: 'Akwa, Douala' }
const send = (order, body = details, user = buyer) =>
  request(app).patch(`/api/v1/orders/${order._id}/delivery-details`).set(asUser(user)).send(body)

describe('PATCH /orders/:id/delivery-details', () => {
  it('saves the details, marks them complete and dispatches now', async () => {
    const order = await paidPopupOrder()
    const res = await send(order)
    expect(res.status).toBe(200)
    const saved = await Order.findById(order._id).lean()
    expect(saved.delivery_details_status).toBe('complete')
    expect(saved.shipping_address).toMatchObject({ quartier: 'Akwa', phone: '699112233', full_name: 'Marie Ngo', landmark: 'Blue gate next to the pharmacy', place_name: 'Akwa, Douala' })
    expect(saved.shipping_address.location).toMatchObject({ lat: 4.0483, lng: 9.6966 })
    expect(Math.abs(new Date(saved.rider_dispatch_at).getTime() - Date.now())).toBeLessThan(10_000)
    let note = null
    for (let i = 0; i < 40 && !note; i += 1) {
      note = await Notification.findOne({ recipient: vendorUser._id, title: 'Delivery details received' }).lean()
      if (!note) await new Promise((r) => setTimeout(r, 50))
    }
    expect(note).toBeTruthy()
  })

  it('hides other people\'s orders', async () => {
    const order = await paidPopupOrder()
    const stranger = await createUser()
    expect((await send(order, details, stranger)).status).toBe(404)
  })

  it('refuses unpaid orders', async () => {
    const order = await paidPopupOrder({ payment_status: 'pending' })
    expect((await send(order)).status).toBe(409)
  })

  it('refuses a different area than the one paid for', async () => {
    const order = await paidPopupOrder()
    const res = await send(order, { ...details, quartier: 'Bonapriso' })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('The delivery area was paid for and cannot change.')
  })

  it('refuses once the parcel was picked up', async () => {
    const order = await paidPopupOrder({ rider_dispatch_at: null })
    await Shipment.create({ order_id: order._id, logistics_id: firm._id, tracking_code: `AURA-${Date.now()}`, status: 'picked_up', price: 1000, delivery_address: { quartier: 'Akwa' } })
    expect((await send(order)).status).toBe(409)
  })

  it('a second submit before pickup updates the order and the waiting shipment', async () => {
    const order = await paidPopupOrder({ rider_dispatch_at: null })
    const shipment = await Shipment.create({ order_id: order._id, logistics_id: firm._id, tracking_code: `AURA-${Date.now()}`, status: 'assigned', price: 1000, delivery_address: { quartier: 'Akwa', city: 'Douala' } })
    expect((await send(order)).status).toBe(200)
    expect((await send(order, { ...details, phone: '655000111' })).status).toBe(200)
    expect((await Order.findById(order._id).lean()).shipping_address.phone).toBe('655000111')
    const updated = await Shipment.findById(shipment._id).lean()
    expect(updated.delivery_address).toMatchObject({ quartier: 'Akwa', phone: '655000111', landmark: 'Blue gate next to the pharmacy' })
    expect((await Order.findById(order._id).lean()).rider_dispatch_at).toBeNull()
  })
})

describe('Creating an instant Buy Now order', () => {
  it('marks it pending and does not remember the area-only address', async () => {
    const product = await createProductForVendor(vendor._id, 'Shoes', { price: 5000, stock: 10 })
    const res = await request(app).post('/api/v1/orders/cart-split').set(asUser(buyer)).send({
      items: [{ product_id: product._id, quantity: 1 }],
      shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456' },
      delivery_quartier: 'Akwa',
      shipping_method: 'vendor_managed',
      payment_method: 'pawapay',
      delivery_details_pending: true,
    })
    expect(res.status).toBeLessThan(300)
    const [orderId] = res.body.data.orderIds
    expect((await Order.findById(orderId).lean()).delivery_details_status).toBe('pending')
    await new Promise((r) => setTimeout(r, 300))
    expect((await User.findById(buyer._id).lean()).addresses || []).toHaveLength(0)
  })
})
