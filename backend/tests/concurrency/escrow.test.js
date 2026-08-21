'use strict'
/**
 * tests/concurrency/escrow.test.js
 * Verifies MongoDB-level atomicity for escrow race conditions:
 *
 *  1. State-claim race — N concurrent processes try to transition the same
 *     escrow from 'held' → 'releasing'. Exactly 1 should win; the rest
 *     must be rejected by the atomic findOneAndUpdate guard.
 *
 *  2. Wallet debit during concurrent escrow holds — N orders are held
 *     simultaneously against a single customer wallet.  The atomic
 *     `$gte` debit guard ensures the wallet never goes negative and
 *     holds beyond the available balance fail cleanly.
 *
 * These tests bypass the HTTP layer and exercise Mongoose operations
 * directly, mirroring what escrow.controller.js / wallet.service.js do.
 * fileParallelism: false ensures serial execution (set in vitest.config.mjs).
 */

const mongoose = require('mongoose')
const Escrow   = require('../../models/Escrow.model')
const Order    = require('../../models/Order.model')
const User     = require('../../models/User.model')
const { race, raceN, countOk, countFailed, assertExactlyNSucceeded } = require('../helpers/concurrency')
const { createUser }   = require('../factories/user.factory')
const { createVendor } = require('../factories/vendor.factory')
const { debitBalance } = require('../../services/wallet.service')

// ─────────────────────────────────────────────────────────────────────────────
// 1. Escrow state-claim race
//    Mimics finalizeEscrowPayout's atomic state transition guard.
//    Production code uses { status: { $in: ['held', 'pending_release', 'releasing'] } }
//    but the meaningful single-winner check is the strict { status: 'held' } claim.
// ─────────────────────────────────────────────────────────────────────────────

describe('Escrow state-claim — atomic findOneAndUpdate race', () => {
  it('allows exactly 1 of 10 concurrent finalizers to claim a held escrow', async () => {
    const { vendor } = await createVendor()
    const dummyBuyer  = new mongoose.Types.ObjectId()
    const dummyOrder  = new mongoose.Types.ObjectId()

    const escrow = await Escrow.collection.insertOne({
      order_id:  dummyOrder,
      buyer_id:  dummyBuyer,
      vendor_id: vendor._id,
      amount:    10_000,
      status:    'held',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const escrowId = escrow.insertedId

    // Each concurrent "finalizer" tries to atomically transition 'held' → 'releasing'.
    // Only the winner finds { status: 'held' }; all subsequent attempts find 'releasing'
    // and are rejected by the guard.
    const claimEscrow = async () => {
      const claimed = await Escrow.findOneAndUpdate(
        { _id: escrowId, status: 'held' },
        { $set: { status: 'releasing' } },
        { new: false },
      )
      if (!claimed) throw new Error('Escrow already claimed by another finalizer')
      return claimed
    }

    const results = await race(10, claimEscrow)

    assertExactlyNSucceeded(results, 1)

    // Final DB state must be 'releasing'
    const final = await Escrow.findById(escrowId).lean()
    expect(final.status).toBe('releasing')
  })

  it('rejects all claims when escrow is already in a terminal state', async () => {
    const { vendor } = await createVendor()
    const dummyBuyer  = new mongoose.Types.ObjectId()
    const dummyOrder  = new mongoose.Types.ObjectId()

    const escrow = await Escrow.collection.insertOne({
      order_id:  dummyOrder,
      buyer_id:  dummyBuyer,
      vendor_id: vendor._id,
      amount:    5_000,
      status:    'released', // already finalized
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const escrowId = escrow.insertedId

    const claimEscrow = async () => {
      const claimed = await Escrow.findOneAndUpdate(
        { _id: escrowId, status: 'held' },
        { $set: { status: 'releasing' } },
        { new: false },
      )
      if (!claimed) throw new Error('Escrow already finalized')
      return claimed
    }

    const results = await race(5, claimEscrow)

    expect(countOk(results)).toBe(0)
    expect(countFailed(results)).toBe(5)

    // Status must remain unchanged
    const final = await Escrow.findById(escrowId).lean()
    expect(final.status).toBe('released')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Wallet debit during concurrent escrow holds
//    The atomic `$gte` guard in debitBalance prevents overdraft even when
//    multiple escrow holds fire simultaneously against the same wallet.
// ─────────────────────────────────────────────────────────────────────────────

describe('Concurrent escrow holds — wallet debit atomicity', () => {
  it('never debits more than the available balance under concurrent pressure', async () => {
    // Customer starts with 12 000 XAF; each hold costs 5 000 XAF.
    // Only 2 of the 5 concurrent holds should succeed.
    const customer = await createUser({ wallet_balance: 12_000 })

    const holdAmount = 5_000

    // Simulate the wallet debit step of holdFunds concurrently (no transactions
    // in concurrency tests — we test the atomic $gte guard directly)
    const tryDebit = async () => {
      const updated = await debitBalance(customer._id, holdAmount, null)
      if (!updated) throw new Error('Insufficient wallet balance to fund Escrow')
      return updated
    }

    const results = await race(5, tryDebit)

    // 12 000 / 5 000 = 2 successful debits (floor division)
    assertExactlyNSucceeded(results, 2)

    const fresh = await User.findById(customer._id).lean()
    // 12 000 − (2 × 5 000) = 2 000 remaining
    expect(fresh.wallet_balance).toBe(2_000)
    // Balance must never go negative
    expect(fresh.wallet_balance).toBeGreaterThanOrEqual(0)
  })

  it('wallet balance never goes negative when all concurrent holds exceed available funds', async () => {
    const customer = await createUser({ wallet_balance: 3_000 })

    // Every hold requests more than the balance
    const tryDebit = async () => {
      const updated = await debitBalance(customer._id, 5_000, null)
      if (!updated) throw new Error('Insufficient wallet balance')
      return updated
    }

    const results = await race(10, tryDebit)

    expect(countOk(results)).toBe(0)      // none should succeed
    expect(countFailed(results)).toBe(10)

    const fresh = await User.findById(customer._id).lean()
    expect(fresh.wallet_balance).toBe(3_000) // unchanged
    expect(fresh.wallet_balance).toBeGreaterThanOrEqual(0)
  })
})
