'use strict'
/**
 * tests/integration/instant-buy-dispatch.test.js
 * Instant Buy Now orders are paid before the buyer gives the exact spot, so
 * no rider goes out until the details arrive (or 30 minutes pass).
 */

const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')
const { buildApp } = require('../setup/app')
const { createUser, createLogisticsUser, createVendor, createOrder } = require('../factories')

const Order = require('../../models/Order.model')
const Shipment = require('../../models/Shipment.model')
const Notification = require('../../models/Notification.model')
const LogisticsCompany = require('../../models/LogisticsCompany.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const { settleOrders } = require('../../services/payment/settle.service')
const { runDelayedRiderDispatch } = require('../../services/delayedRiderDispatch.service')

let app
beforeAll(() => { app = buildApp() })

let buyer, vendor, vendorUser, firm, firmOwner
beforeEach(async () => {
  await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage' }])
  buyer = await createUser({ wallet_balance: 0 })
  ;({ user: vendorUser, vendor } = await createVendor())
  firmOwner = await createLogisticsUser()
  firm = await LogisticsCompany.create({ user_id: firmOwner._id, company_name: 'FastShip', contact_email: faker.internet.email().toLowerCase(), contact_phone: '+237600000099', service_regions: ['Douala'], vehicle_types: ['motorcycle'], quartier_prices: [{ quartier: 'Akwa', price: 1000 }] })
})

const popupOrder = (overrides = {}) => createOrder({ customerId: buyer._id, vendorId: vendor._id }, {
  payment_method: 'pawapay',
  shipping_method: 'logistics_partner',
  logistics_company_id: firm._id,
  shipping_address: { quartier: 'Akwa', city: 'Douala', phone: '677123456' },
  delivery_details_status: 'pending',
  ...overrides,
})

const settle = async (order) => {
  const session = await mongoose.startSession()
  await session.withTransaction(() => settleOrders(buyer._id, [order._id], session, app, true, '', 'pawapay'))
  await session.endSession()
}

describe('Instant Buy Now dispatch hold', () => {
  it('pays a pending-details order without creating a shipment', async () => {
    const order = await popupOrder()
    const before = Date.now()
    await settle(order)
    const paid = await Order.findById(order._id).lean()
    expect(paid.payment_status).toBe('paid')
    expect(await Shipment.countDocuments({ order_id: order._id })).toBe(0)
    const wait = new Date(paid.rider_dispatch_at).getTime() - before
    expect(wait).toBeGreaterThan(29 * 60 * 1000)
    expect(wait).toBeLessThan(31 * 60 * 1000)
  })

  it('creates the shipment once rider_dispatch_at has passed', async () => {
    const order = await popupOrder()
    await settle(order)
    await Order.updateOne({ _id: order._id }, { $set: { rider_dispatch_at: new Date(Date.now() - 1000) } })
    await runDelayedRiderDispatch(app)
    expect(await Shipment.countDocuments({ order_id: order._id })).toBe(1)
    expect((await Order.findById(order._id).lean()).rider_dispatch_at).toBeNull()
  })

  it('still dispatches normal checkout orders at payment', async () => {
    const order = await popupOrder({ delivery_details_status: null })
    await settle(order)
    expect(await Shipment.countDocuments({ order_id: order._id })).toBe(1)
  })

  it('tells the vendor and the firm to call the buyer when details never came', async () => {
    const order = await popupOrder()
    await settle(order)
    await Order.updateOne({ _id: order._id }, { $set: { rider_dispatch_at: new Date(Date.now() - 1000) } })
    await runDelayedRiderDispatch(app)
    const waitFor = async (fn) => { for (let i = 0; i < 60; i += 1) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 50)) } return null }
    const calls = await waitFor(async () => {
      const n = await Notification.find({ message: /Buyer has not sent the exact spot\. Call 677123456 before delivery\./ }).lean()
      return n.length >= 2 ? n : null
    })
    expect(calls.map((n) => String(n.recipient)).sort()).toEqual([String(vendorUser._id), String(firmOwner._id)].sort())
  })
})
