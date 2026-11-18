'use strict'
/**
 * tests/integration/guest-maintenance.test.js
 * Guests cannot open a wallet, so refunded money goes back to their Mobile
 * Money number automatically; idle guest accounts are removed.
 */

const { buildApp } = require('../setup/app')
const { createUser, createVendor, createOrder } = require('../factories')

const User = require('../../models/User.model')
const WithdrawalRequest = require('../../models/WithdrawalRequest.model')
const Transaction = require('../../models/Transaction.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const { sweepGuestRefunds, purgeIdleGuests } = require('../../services/guestMaintenance.service')

beforeAll(() => { buildApp() })
beforeEach(async () => { await PlatformSettings.create([{ commission_rate: 0, commission_type: 'percentage' }]) })

const guestWithOrder = async (balance) => {
  const guest = await createUser({ is_guest: true, wallet_balance: balance })
  const { vendor } = await createVendor()
  await createOrder({ customerId: guest._id, vendorId: vendor._id }, { payment_status: 'refunded', shipping_address: { quartier: 'Akwa', phone: '677123456' } })
  return guest
}

describe('sweepGuestRefunds', () => {
  it('sends a refunded balance of 500 or more to the guest MoMo number', async () => {
    const guest = await guestWithOrder(4500)
    expect(await sweepGuestRefunds()).toBe(1)
    const wr = await WithdrawalRequest.findOne({ requested_by: guest._id }).lean()
    expect(wr).toMatchObject({ amount: 4500, status: 'pending', withdrawal_method: 'momo', balance_deducted: true })
    expect(wr.recipient_details).toMatchObject({ phone_number: '677123456', first_name: 'Guest', last_name: 'Buyer', country: 'CM' })
    expect((await User.findById(guest._id).lean()).wallet_balance).toBe(0)
    expect(await Transaction.countDocuments({ user_id: guest._id, type: 'withdrawal', amount: 4500 })).toBe(1)
  })

  it('leaves balances under 500', async () => {
    const guest = await guestWithOrder(499)
    expect(await sweepGuestRefunds()).toBe(0)
    expect(await WithdrawalRequest.countDocuments({ requested_by: guest._id })).toBe(0)
  })

  it('never creates a second withdrawal for the same guest', async () => {
    const guest = await guestWithOrder(2000)
    await sweepGuestRefunds()
    await User.updateOne({ _id: guest._id }, { $set: { wallet_balance: 1000 } })
    expect(await sweepGuestRefunds()).toBe(0)
    expect(await WithdrawalRequest.countDocuments({ requested_by: guest._id })).toBe(1)
  })

  it('ignores real accounts', async () => {
    const member = await createUser({ wallet_balance: 9000 })
    await sweepGuestRefunds()
    expect(await WithdrawalRequest.countDocuments({ requested_by: member._id })).toBe(0)
  })
})

describe('purgeIdleGuests', () => {
  it('removes old guests without orders and keeps everyone else', async () => {
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000)
    const idle = await createUser({ is_guest: true })
    const buyer = await guestWithOrder(0)
    const fresh = await createUser({ is_guest: true })
    const member = await createUser()
    await User.collection.updateMany({ _id: { $in: [idle._id, buyer._id, member._id] } }, { $set: { createdAt: old } })
    expect(await purgeIdleGuests()).toBe(1)
    expect(await User.exists({ _id: idle._id })).toBeNull()
    for (const kept of [buyer, fresh, member]) expect(await User.exists({ _id: kept._id })).toBeTruthy()
  })
})
