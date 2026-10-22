'use strict'
/**
 * tests/integration/revenue-consistency.test.js
 * One definition of "earned revenue" everywhere: the vendor dashboard card,
 * its sales chart, the admin dashboard and the manager overview must agree.
 *
 * Earned = not cancelled/refunded AND (paid OR pay-on-delivery that was
 * delivered/completed — the cash was collected at the door).
 */

const request = require('supertest')
const mongoose = require('mongoose')

const { buildApp } = require('../setup/app')
const { createUser, createVendor, createAdmin, createOrder } = require('../factories')
const { asUser } = require('../helpers/auth')
const PlatformSettings = require('../../models/PlatformSettings.model')
const ManagerAssignment = require('../../models/ManagerAssignment.model')

let app
beforeAll(() => { app = buildApp() })

let vendorUser, vendor, customer

const order = (overrides) => createOrder(
  { customerId: customer._id, vendorId: vendor._id },
  { subtotal: overrides.total_amount, shipping_fee: 0, ...overrides },
)

beforeEach(async () => {
  await PlatformSettings.create({ subscription_required_roles: { vendor: false, logistics: false, customer: false } })
  ;({ user: vendorUser, vendor } = await createVendor({ verified: true, is_onboarded: true }))
  customer = await createUser()

  // Earned: 10,000 + 4,000 + 6,000 = 20,000
  await order({ total_amount: 10_000, payment_method: 'wallet', payment_status: 'paid', order_status: 'delivered' })
  await order({ total_amount: 4_000, payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'delivered' })
  await order({ total_amount: 6_000, payment_method: 'wallet', payment_status: 'paid', order_status: 'processing' })
  // Not earned
  await order({ total_amount: 50_000, payment_method: 'pawapay', payment_status: 'pending', order_status: 'placed' }) // never paid
  await order({ total_amount: 30_000, payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'shipped' }) // cash not collected yet
  await order({ total_amount: 7_000, payment_method: 'wallet', payment_status: 'refunded', order_status: 'refunded' })
  await order({ total_amount: 9_000, payment_method: 'wallet', payment_status: 'paid', order_status: 'cancelled' })
})

describe('earned revenue is the same on every surface', () => {
  it('vendor dashboard: the revenue card equals the sales chart total', async () => {
    const res = await request(app).get('/api/v1/vendor/analytics').set(asUser(vendorUser))
    expect(res.status).toBe(200)
    const { stats, sales_history } = res.body.data
    expect(stats.total_revenue).toBe(20_000)
    expect(sales_history.reduce((sum, m) => sum + m.revenue, 0)).toBe(20_000)
  })

  it('admin dashboard counts the same earned revenue', async () => {
    const admin = await createAdmin()
    const res = await request(app).get('/api/v1/admin/analytics').set(asUser(admin))
    expect(res.status).toBe(200)
    expect(res.body.data.stats.revenue).toBe(20_000)
  })

  it('manager overview counts the same earned revenue', async () => {
    const manager = await createUser({ role: 'manager', previous_role: 'customer' })
    await ManagerAssignment.create({
      manager_id: manager._id, user_id: vendorUser._id, status: 'active', initiated_by: 'admin',
      permissions: { products: true, orders: true, messages: true, money: true, profile: true },
    })
    const res = await request(app).get('/api/v1/manager/overview').set(asUser(manager))
    expect(res.status).toBe(200)
    expect(res.body.data.totals.revenue30d).toBe(20_000)
  })
})
