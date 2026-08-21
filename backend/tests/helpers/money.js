'use strict'
/**
 * tests/helpers/money.js
 * Wallet balance assertion helpers.
 *
 * Usage:
 *   const { assertBalance, assertBalanceChanged } = require('../helpers/money')
 *
 *   await assertBalance(userId, 5000)
 *   const result = await assertBalanceChanged(userId, async () => {
 *     await adjustBalance(userId, -1000, null, { ... })
 *   })
 *   expect(result.delta).toBe(-1000)
 */

const User = require('../../models/User.model')

/**
 * Assert that a user's current wallet_balance equals the expected value.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {number} expected  Expected balance in XAF
 */
const assertBalance = async (userId, expected) => {
  const user = await User.findById(userId).select('wallet_balance').lean()
  if (!user) throw new Error(`[money helper] User ${userId} not found`)
  expect(user.wallet_balance).toBe(expected)
}

/**
 * Fetch the current balance of a user.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<number>}
 */
const getBalance = async (userId) => {
  const user = await User.findById(userId).select('wallet_balance').lean()
  if (!user) throw new Error(`[money helper] User ${userId} not found`)
  return user.wallet_balance
}

/**
 * Run an async action and return the wallet balance delta.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {() => Promise<any>} action
 * @returns {Promise<{ before: number, after: number, delta: number }>}
 */
const assertBalanceChanged = async (userId, action) => {
  const before = await getBalance(userId)
  await action()
  const after = await getBalance(userId)
  return { before, after, delta: after - before }
}

/**
 * Assert that a user's balance increased by exactly `amount` after an action.
 */
const assertCredited = async (userId, amount, action) => {
  const { delta } = await assertBalanceChanged(userId, action)
  expect(delta).toBe(amount)
}

/**
 * Assert that a user's balance decreased by exactly `amount` after an action.
 */
const assertDebited = async (userId, amount, action) => {
  const { delta } = await assertBalanceChanged(userId, action)
  expect(delta).toBe(-amount)
}

module.exports = { assertBalance, getBalance, assertBalanceChanged, assertCredited, assertDebited }
