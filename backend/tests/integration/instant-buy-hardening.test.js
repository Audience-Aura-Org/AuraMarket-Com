'use strict'
/**
 * tests/integration/instant-buy-hardening.test.js
 * Fixes from the whole-branch review of Instant Buy Now.
 */

const mongoose = require('mongoose')
const request = require('supertest')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser, createVendor, createOrder, createProductForVendor, createTransaction } = require('../factories')
const { asUser } = require('../helpers/auth')

const Order = require('../../models/Order.model')
const Shipment = require('../../models/Shipment.model')
const LogisticZone = require('../../models/LogisticZone.model')
const WithdrawalRequest = require('../../models/WithdrawalRequest.model')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const { settleOrders } = require('../../services/payment/settle.service')
const { runDelayedRiderDispatch } = require('../../services/delayedRiderDispatch.service')
const { sweepGuestRefunds } = require('../../services/guestMaintenance.service')

let app
beforeAll(() => { app = buildApp() })

let buyer, vendor, firm
const flagOn = (on = true) => PlatformSettings.updateOne({}, { $set: { 'features.instant_buy': on } })
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage', features: { instant_buy: true } }])
  buyer = await createUser()
  ;({ vendor } = await createVendor())
  const owner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: owner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'], quartier_prices: [{ quartier: 'Akwa', price: 1000 }] })
})

const popupOrder = (overrides = {}) => createOrder({ customerId: buyer._id, vendorId: vendor._id }, {
  payment_method: 'pawapay', shipping_method: 'logistics_partner', logistics_company_id: firm._id,
  shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456' }, delivery_details_status: 'pending', ...overrides,
})
const settle = async (order) => {
  const session = await mongoose.startSession()
  await session.withTransaction(() => settleOrders(buyer._id, [order._id], session, app, true, '', 'pawapay'))
  await session.endSession()
}
const details = (order, body, user = buyer) => request(app).patch(`/api/v1/orders/${order._id}/delivery-details`).set(asUser(user)).send(body)

describe('dispatch hold', () => {
  it('sends no rider for an order cancelled or refunded during the hold', async () => {
    const order = await popupOrder()
    await settle(order)
    await Order.updateOne({ _id: order._id }, { $set: { order_status: 'cancelled', payment_status: 'refunded', rider_dispatch_at: new Date(Date.now() - 1000) } })
    await runDelayedRiderDispatch(app)
    expect(await Shipment.countDocuments({ order_id: order._id })).toBe(0)
  })
})

describe('guest refunds', () => {
  it('pay back the number that paid, never the delivery contact', async () => {
    const guest = await createUser({ is_guest: true, wallet_balance: 3000 })
    await createOrder({ customerId: guest._id, vendorId: vendor._id }, { payment_status: 'refunded', shipping_address: { quartier: 'Akwa', phone: '699000000' } })
    await createTransaction(guest._id, { type: 'payment', status: 'completed', gateway: 'pawapay', metadata: { phone: '237677123456' } })
    expect(await sweepGuestRefunds()).toBe(1)
    expect((await WithdrawalRequest.findOne({ requested_by: guest._id }).lean()).recipient_details.phone_number).toBe('237677123456')
  })

  it('without a paying number on record, nothing is sent', async () => {
    const guest = await createUser({ is_guest: true, wallet_balance: 3000 })
    await createOrder({ customerId: guest._id, vendorId: vendor._id }, { payment_status: 'refunded', shipping_address: { quartier: 'Akwa', phone: '699000000' } })
    expect(await sweepGuestRefunds()).toBe(0)
  })

  it('follow maintenance mode, the minimum withdrawal and stop after 3 failed payouts', async () => {
    const guest = await createUser({ is_guest: true, wallet_balance: 800 })
    await createTransaction(guest._id, { type: 'payment', status: 'completed', gateway: 'pawapay', metadata: { phone: '237677123456' } })
    await PlatformSettings.updateOne({}, { $set: { min_withdrawal_amount: 1000 } })
    expect(await sweepGuestRefunds()).toBe(0)
    await PlatformSettings.updateOne({}, { $set: { min_withdrawal_amount: 500, withdrawals_maintenance_mode: true } })
    expect(await sweepGuestRefunds()).toBe(0)
    await PlatformSettings.updateOne({}, { $set: { withdrawals_maintenance_mode: false } })
    const failed = { requested_by: guest._id, role: 'user', amount: 800, currency: 'XAF', withdrawal_method: 'momo', recipient_details: { phone_number: '237677123456', first_name: 'Guest', last_name: 'Buyer', country: 'CM' } }
    await WithdrawalRequest.create([{ ...failed, status: 'failed' }, { ...failed, status: 'rejected' }, { ...failed, status: 'failed' }])
    expect(await sweepGuestRefunds()).toBe(0)
  })
})

describe('instant_buy flag on the server', () => {
  it('no guest sessions while the flag is off', async () => {
    await flagOn(false)
    expect((await request(app).post('/api/v1/auth/guest').send({})).status).toBe(403)
    await flagOn(true)
    expect((await request(app).post('/api/v1/auth/guest').send({})).status).toBe(201)
  })

  it('ignores delivery_details_pending while the flag is off', async () => {
    await flagOn(false)
    const product = await createProductForVendor(vendor._id, 'Shoes', { price: 5000, stock: 10 })
    const res = await request(app).post('/api/v1/orders/cart-split').set(asUser(buyer)).send({
      items: [{ product_id: product._id, quantity: 1 }], shipping_address: { quartier: 'Akwa', city: 'Douala' },
      delivery_quartier: 'Akwa', shipping_method: 'vendor_managed', payment_method: 'pawapay', delivery_details_pending: true,
    })
    expect(res.status).toBeLessThan(300)
    expect((await Order.findById(res.body.data.orderIds[0]).lean()).delivery_details_status).toBeNull()
  })
})

describe('delivery details endpoint', () => {
  it('only accepts Instant Buy orders', async () => {
    const order = await popupOrder({ payment_status: 'paid', delivery_details_status: null })
    expect((await details(order, { phone: '699112233' })).status).toBe(409)
  })

  it('keeps the paid zone and refuses a pin far outside it', async () => {
    const zone = await LogisticZone.create({ name: 'Akwa', type: 'quartier', centroid: { type: 'Point', coordinates: [9.6966, 4.0483] } })
    const order = await popupOrder({ payment_status: 'paid', shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456', zone_id: zone._id } })
    const far = await details(order, { phone: '699112233', location: { lat: 3.848, lng: 11.502, source: 'pin' } }) // Yaoundé
    expect(far.status).toBe(400)
    expect(far.body.message).toBe('That spot is outside the area you paid for.')
    const other = new mongoose.Types.ObjectId()
    expect((await details(order, { phone: '699112233', zone_id: other, location: { lat: 4.05, lng: 9.70, source: 'pin' } })).status).toBe(200)
    expect(String((await Order.findById(order._id).lean()).shipping_address.zone_id)).toBe(String(zone._id))
  })

  it('does not bring a meal rider forward while the kitchen is cooking', async () => {
    const later = new Date(Date.now() + 20 * 60 * 1000)
    const order = await popupOrder({ payment_status: 'paid', food_status: 'preparing', fulfilment_type: 'delivery', rider_dispatch_at: later })
    expect((await details(order, { phone: '699112233' })).status).toBe(200)
    expect(new Date((await Order.findById(order._id).lean()).rider_dispatch_at).getTime()).toBe(later.getTime())
  })
})

describe('guest tokens reach only the Buy Now routes', () => {
  it('allows orders and payment status, refuses account, chat and dispute routes', async () => {
    const { body } = await request(app).post('/api/v1/auth/guest').send({})
    const auth = { Authorization: `Bearer ${body.token}` }
    expect((await request(app).get('/api/v1/orders/my-orders').set(auth)).status).toBe(200)
    expect((await request(app).get('/api/v1/auth/me').set(auth)).status).toBe(200)
    expect((await request(app).post('/api/v1/payments/checkout/failed').set(auth).send({ order_ids: [] })).status).not.toBe(403)
    const product = await createProductForVendor(vendor._id, 'Shoes', { price: 5000, stock: 10 })
    const order = await request(app).post('/api/v1/orders/cart-split').set(auth).send({
      items: [{ product_id: product._id, quantity: 1 }], shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456' },
      delivery_quartier: 'Akwa', shipping_method: 'vendor_managed', payment_method: 'pawapay', delivery_details_pending: true,
    })
    expect(order.status).toBe(201)
    for (const [method, url] of [['patch', '/api/v1/users/me'], ['post', '/api/v1/chat/conversations'], ['get', '/api/v1/disputes']]) {
      const res = await request(app)[method](url).set(auth).send({})
      expect(res.status, `${method} ${url}`).toBe(403)
    }
  })
})
