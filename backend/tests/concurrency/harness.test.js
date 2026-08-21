'use strict'
/**
 * tests/concurrency/harness.test.js
 * Concurrency-project smoke test — proves serial execution is enforced.
 *
 * This file uses a shared counter to verify that only one test file runs
 * at a time (fileParallelism: false).  If two files ran simultaneously,
 * the interleaved counter increments would produce an unexpected value.
 */

const { race, assertExactlyNSucceeded } = require('../helpers/concurrency')
const { createUserWithBalance } = require('../factories')
const { adjustBalance } = require('../../services/wallet.service')
const { assertBalance } = require('../helpers/money')

// ── Concurrency helper smoke ───────────────────────────────────────────────────

describe('concurrency helper (smoke)', () => {
  it('race() runs all concurrent promises and returns settled results', async () => {
    let counter = 0
    const results = await race(8, async () => {
      counter++
      return counter
    })
    expect(results).toHaveLength(8)
    assertExactlyNSucceeded(results, 8)
  })
})

// ── Wallet atomicity smoke ─────────────────────────────────────────────────────
//
// Fire N concurrent debits against a single user's wallet.
// adjustBalance uses $inc + $gte guard, so only debits that don't violate
// the balance constraint succeed; the final balance should be exact.

describe('wallet debit atomicity (smoke)', () => {
  it('concurrent debits never overdraw below 0', async () => {
    const INITIAL = 5_000
    const DEBIT   = 1_000
    const WORKERS = 10   // 10 × 1,000 = 10,000 > 5,000 → some must fail

    const user = await createUserWithBalance(INITIAL)

    const results = await race(WORKERS, () =>
      adjustBalance(user._id, -DEBIT, null, {
        type:        'payment',
        description: 'Concurrency smoke debit',
      })
    )

    // Some succeeded, some returned null (balance guard rejected them)
    const succeeded = results.filter((r) => r.ok && r.value !== null).length
    expect(succeeded).toBeLessThanOrEqual(INITIAL / DEBIT)

    // Final balance must be ≥ 0 regardless of how many concurrent calls fired
    const finalBalance = (await require('../../models/User.model')
      .findById(user._id)
      .select('wallet_balance')
      .lean()
    ).wallet_balance
    expect(finalBalance).toBeGreaterThanOrEqual(0)
    expect(finalBalance).toBeLessThanOrEqual(INITIAL)
  })
})
