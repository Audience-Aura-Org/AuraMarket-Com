'use strict'
const request = require('supertest')
const mongoose = require('mongoose')
const { buildApp } = require('../setup/app')
const { createUser, createAdmin, createOrder } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')
let app, admin, customer
beforeAll(() => { app = buildApp() })
beforeEach(async () => { admin = await createAdmin(); customer = await createUser({ name: 'Order Search Customer' }) })
const orders = () => request(app).get('/api/v1/admin/orders').set(authHeader(signToken(admin)))
it('paginates paid orders without losing the global total', async () => {
  const vendorId = new mongoose.Types.ObjectId()
  for (let i=0;i<3;i++) await createOrder({ customerId: customer._id, vendorId }, { payment_status: 'paid' })
  const first = await orders().query({ page: 1, limit: 2 })
  const second = await orders().query({ page: 2, limit: 2 })
  expect(first.status).toBe(200); expect(first.body.total).toBe(3)
  expect(first.body.data.orders).toHaveLength(2); expect(second.body.data.orders).toHaveLength(1)
  expect(first.body.data.orders.map(o=>o._id)).not.toContain(second.body.data.orders[0]._id)
})
it('searches customers on the server while keeping the paid-order boundary', async () => {
  const vendorId = new mongoose.Types.ObjectId()
  await createOrder({ customerId: customer._id, vendorId }, { payment_status: 'paid' })
  await createOrder({ customerId: customer._id, vendorId }, { payment_status: 'pending' })
  const result = await orders().query({ search: 'Order Search Customer' })
  expect(result.status).toBe(200); expect(result.body.total).toBe(1)
})
it('treats regex characters as literal search text', async () => {
  await createOrder({ customerId: customer._id, vendorId: new mongoose.Types.ObjectId() }, { payment_status: 'paid' })
  const result = await orders().query({ search: '.*' })
  expect(result.status).toBe(200); expect(result.body.total).toBe(0)
})

it('rejects payment and refund edits that bypass settlement workflows', async () => {
  const order = await createOrder({ customerId: customer._id, vendorId: new mongoose.Types.ObjectId() }, { payment_status: 'pending' })
  const path = '/api/v1/admin/orders/' + order._id
  const payment = await request(app).patch(path).set(authHeader(signToken(admin))).send({ payment_status: 'paid' })
  expect(payment.status).toBe(409)
  const refund = await request(app).patch(path).set(authHeader(signToken(admin))).send({ order_status: 'refunded' })
  expect(refund.status).toBe(409)
  const Order = require('../../models/Order.model')
  expect((await Order.findById(order._id)).payment_status).toBe('pending')
})
