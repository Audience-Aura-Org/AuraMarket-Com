'use strict'
/**
 * tests/integration/food-clawback.test.js
 * clawbackFoodRefund — refunding a food order (no escrow) after a dispute.
 * Both branches give the platform's fee back out of platform_wallet_balance.
 */

const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const { createUser, createVendorUser, createOrder } = require('../factories')
const Vendor           = require('../../models/Vendor.model')
const User             = require('../../models/User.model')
const Transaction      = require('../../models/Transaction.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const { clawbackFoodRefund } = require('../../services/payment/settle.service')

let customer, vendorUser, vendorDoc, order

beforeEach(async () => {
  await PlatformSettings.create({ platform_wallet_balance: 10_000 })
  customer   = await createUser({ wallet_balance: 0 })
  vendorUser = await createVendorUser({ wallet_balance: 0 })
  vendorDoc  = await Vendor.create({
    user_id: vendorUser._id, store_name: faker.company.name().slice(0, 100),
    description: 'Kitchen', phone: '+237600000009', vendor_type: 'restaurant',
  })
  order = await createOrder({ customerId: customer._id, vendorId: vendorDoc._id }, {
    total_amount: 5_000, subtotal: 5_000, payment_status: 'paid', payment_method: 'wallet', escrow_enabled: false,
  })
})

const runClawback = async (amount) => {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const doc = await order.constructor.findById(order._id).session(session)
      await clawbackFoodRefund(doc, amount, session, 'Test dispute')
    })
  } finally {
    await session.endSession()
  }
}

const platformBalance = async () => (await PlatformSettings.findOne().lean()).platform_wallet_balance

describe('clawbackFoodRefund', () => {
  it('held payout: voids it, refunds the buyer and returns the pre-committed platform fee', async () => {
    await Transaction.create({
      user_id: vendorUser._id, order_id: order._id, type: 'payout', status: 'pending', amount: 4_500,
      reference: `PAYOUT-HELD-${Date.now()}`, gateway: 'platform', description: 'Held payout',
      metadata: { platform_fee_breakdown: { platform_fee: 500, vendor_payout: 4_500 } },
    })

    await runClawback(5_000)

    expect((await User.findById(customer._id)).wallet_balance).toBe(5_000)
    expect((await User.findById(vendorUser._id)).wallet_balance).toBe(0)
    expect(await platformBalance()).toBe(9_500)
  })

  it('released payout: claws back the vendor share and the platform returns its commission', async () => {
    await Transaction.create({
      user_id: vendorUser._id, order_id: order._id, type: 'payout', status: 'completed', amount: 4_500,
      reference: `PAYOUT-${Date.now()}`, gateway: 'platform', description: 'Payout',
    })
    await User.updateOne({ _id: vendorUser._id }, { wallet_balance: 4_500 })

    await runClawback(5_000)

    expect((await User.findById(customer._id)).wallet_balance).toBe(5_000)
    expect((await User.findById(vendorUser._id)).wallet_balance).toBe(0)
    expect(await platformBalance()).toBe(9_500)
  })
})
