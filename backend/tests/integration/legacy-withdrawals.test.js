'use strict'
/**
 * tests/integration/legacy-withdrawals.test.js
 * Withdrawals made through the retired POST /wallet/withdraw debited the
 * balance but never reached the admin payout queue. The recovery service
 * finds exactly those and refunds them, once.
 */

const mongoose = require('mongoose')

const { createUser }   = require('../factories')
const User             = require('../../models/User.model')
const Transaction      = require('../../models/Transaction.model')
const Notification     = require('../../models/Notification.model')
const {
  findLegacyPendingWithdrawals,
  refundLegacyWithdrawal,
} = require('../../services/legacyWithdrawals.service')

beforeAll(async () => {
  await Promise.all([Transaction.createCollection(), User.createCollection(), Notification.createCollection()]).catch(() => {})
})

/** What the retired endpoint wrote: balance already debited, no payout request. */
const legacyWithdrawal = (userId, amount) => Transaction.create({
  user_id: userId, type: 'withdrawal', amount, status: 'pending',
  reference: `LEG-${new mongoose.Types.ObjectId()}`, description: 'Withdrawal to MTN MoMo (677000001)',
  gateway_response: { method: 'mtn', details: { account_number: '677000001' }, requested_at: new Date() },
})

describe('findLegacyPendingWithdrawals', () => {
  it('finds only stranded legacy withdrawals', async () => {
    const user = await createUser({ wallet_balance: 1_000 })
    const legacy = await legacyWithdrawal(user._id, 5_000)

    // Not legacy: current flow (linked payout request), admin direct payout, already settled legacy
    await Transaction.create({ user_id: user._id, type: 'withdrawal', amount: 2_000, status: 'pending', reference: 'NEW-1', description: 'Withdrawal via MOMO',
      metadata: { withdrawal_request_id: new mongoose.Types.ObjectId() } })
    await Transaction.create({ user_id: user._id, type: 'withdrawal', amount: 3_000, status: 'pending', reference: 'ADM-1', description: 'Admin direct payout',
      gateway: 'pawapay', metadata: { admin_direct: true } })
    const settled = await legacyWithdrawal(user._id, 700)
    await Transaction.updateOne({ _id: settled._id }, { status: 'completed' })

    const found = await findLegacyPendingWithdrawals()
    expect(found.map((t) => String(t._id))).toEqual([String(legacy._id)])
    expect(found[0]).toMatchObject({ amount: 5_000, user: { email: user.email } })
  })
})

describe('refundLegacyWithdrawal', () => {
  it('returns the money, closes the transaction, and tells the user', async () => {
    const user = await createUser({ wallet_balance: 1_000 })
    const tx = await legacyWithdrawal(user._id, 5_000)

    const result = await refundLegacyWithdrawal(tx._id)

    expect(result).toMatchObject({ refunded: true, amount: 5_000, balance: 6_000 })
    expect((await User.findById(user._id)).wallet_balance).toBe(6_000)
    const closed = await Transaction.findById(tx._id)
    expect(closed.status).toBe('rejected')
    expect(closed.metadata.legacy_refund.refunded_at).toBeInstanceOf(Date)
    expect(await Notification.countDocuments({ recipient: user._id })).toBe(1)
  })

  it('is idempotent: a second run never refunds twice', async () => {
    const user = await createUser({ wallet_balance: 0 })
    const tx = await legacyWithdrawal(user._id, 2_500)

    await refundLegacyWithdrawal(tx._id)
    const again = await refundLegacyWithdrawal(tx._id)

    expect(again).toMatchObject({ refunded: false, reason: 'not_pending_legacy' })
    expect((await User.findById(user._id)).wallet_balance).toBe(2_500)
  })

  it('refuses transactions that are not legacy withdrawals', async () => {
    const user = await createUser({ wallet_balance: 0 })
    const modern = await Transaction.create({ user_id: user._id, type: 'withdrawal', amount: 2_000, status: 'pending',
      reference: 'NEW-2', description: 'Withdrawal via MOMO', metadata: { withdrawal_request_id: new mongoose.Types.ObjectId() } })

    expect(await refundLegacyWithdrawal(modern._id)).toMatchObject({ refunded: false })
    expect((await User.findById(user._id)).wallet_balance).toBe(0)
    expect((await Transaction.findById(modern._id)).status).toBe('pending')
  })
})
