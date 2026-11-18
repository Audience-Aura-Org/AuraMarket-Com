'use strict'
/**
 * tests/integration/guest-claim.test.js
 * Signing in on the device that holds a guest session moves the guest's
 * orders, payments and refunded balance into the real account.
 */

const request = require('supertest')
const { buildApp } = require('../setup/app')
const { createUser, createVendor, createOrder, createTransaction, createEscrow } = require('../factories')
const { asUser } = require('../helpers/auth')

const Order = require('../../models/Order.model')
const Transaction = require('../../models/Transaction.model')
const Escrow = require('../../models/Escrow.model')
const User = require('../../models/User.model')

let app
beforeAll(() => { app = buildApp() })

const newGuest = async () => {
  const res = await request(app).post('/api/v1/auth/guest').send({})
  return { token: res.body.token, id: res.body.data.user._id }
}
const claim = (user, guestToken) => request(app).post('/api/v1/auth/guest/claim').set(asUser(user)).send({ guest_token: guestToken })

describe('POST /auth/guest/claim', () => {
  it('moves orders, transactions, escrow and balance in one go', async () => {
    const guest = await newGuest()
    const { vendor } = await createVendor()
    const order = await createOrder({ customerId: guest.id, vendorId: vendor._id }, { payment_status: 'paid' })
    await createTransaction(guest.id, { order_ids: [order._id] })
    await createEscrow({ orderId: order._id, customerId: guest.id, vendorId: vendor._id })
    await User.updateOne({ _id: guest.id }, { $set: { wallet_balance: 300 } })
    const member = await createUser({ wallet_balance: 1000 })

    const res = await claim(member, guest.token)
    expect(res.status).toBe(200)
    expect(res.body.data.orders).toBe(1)
    expect(String((await Order.findById(order._id).lean()).customer_id)).toBe(String(member._id))
    expect(await Transaction.countDocuments({ user_id: guest.id })).toBe(0)
    expect(await Escrow.countDocuments({ buyer_id: guest.id })).toBe(0)
    expect((await User.findById(member._id).lean()).wallet_balance).toBe(1300)
    const closed = await User.findById(guest.id).lean()
    expect(closed).toMatchObject({ is_active: false, wallet_balance: 0 })
  })

  it('a second claim by the same account moves nothing', async () => {
    const guest = await newGuest()
    const member = await createUser()
    expect((await claim(member, guest.token)).status).toBe(200)
    const again = await claim(member, guest.token)
    expect(again.status).toBe(200)
    expect(again.body.data.orders).toBe(0)
  })

  it('refuses a token that is not a guest session', async () => {
    const member = await createUser()
    const other = await createUser()
    const jwt = require('jsonwebtoken')
    const token = jwt.sign({ id: other._id, tokenVersion: 0, type: 'auth' }, process.env.JWT_SECRET)
    expect((await claim(member, token)).status).toBe(400)
    expect((await claim(member, 'not-a-token')).status).toBe(400)
  })

  it('a guest cannot claim', async () => {
    const guest = await newGuest()
    const other = await newGuest()
    const res = await request(app).post('/api/v1/auth/guest/claim').set({ Authorization: `Bearer ${guest.token}` }).send({ guest_token: other.token })
    expect(res.status).toBe(403)
  })
})
