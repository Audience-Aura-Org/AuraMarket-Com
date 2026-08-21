'use strict'
/**
 * tests/factories/transaction.factory.js
 * Factory for Transaction documents.
 */

const { faker } = require('@faker-js/faker')
const crypto = require('crypto')
const Transaction = require('../../models/Transaction.model')

const genRef = () => `AURA-TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`

/**
 * Build a plain Transaction object (not saved).
 */
const buildTransaction = (userId, overrides = {}) => ({
  user_id:     userId,
  type:        'deposit',
  amount:      faker.number.int({ min: 100, max: 100_000 }),
  reference:   genRef(),
  status:      'completed',
  description: faker.finance.transactionDescription(),
  gateway:     'wallet',
  ...overrides,
})

/**
 * Create and save a Transaction.
 */
const createTransaction = async (userId, overrides = {}) =>
  Transaction.create(buildTransaction(userId, overrides))

/**
 * Create a pending deposit Transaction (common state before webhook arrives).
 */
const createPendingDeposit = (userId, overrides = {}) =>
  createTransaction(userId, {
    type:    'deposit',
    status:  'pending',
    gateway: 'eversend',
    ...overrides,
  })

module.exports = { genRef, buildTransaction, createTransaction, createPendingDeposit }
