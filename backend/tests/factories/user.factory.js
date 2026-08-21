'use strict'
/**
 * tests/factories/user.factory.js
 * Factory for User documents.
 */

const { faker } = require('@faker-js/faker')
const User = require('../../models/User.model')

/** Password used when creating test users (pre-hashing by bcrypt pre-save hook). */
const DEFAULT_PASSWORD = 'TestPass123!'

/**
 * Build a plain User object (not saved to DB).
 * @param {Partial<import('../../models/User.model').IUser>} overrides
 */
const buildUser = (overrides = {}) => ({
  name:                faker.person.fullName(),
  email:               faker.internet.email().toLowerCase(),
  password:            DEFAULT_PASSWORD,
  role:                'customer',
  auth_provider:       'password',
  verification_status: 'verified',
  is_active:           true,
  wallet_balance:      0,
  ...overrides,
})

/**
 * Create and save a User. Password is hashed by the pre-save hook.
 * @param {object} [overrides]
 * @returns {Promise<import('mongoose').Document>}
 */
const createUser = async (overrides = {}) =>
  User.create(buildUser(overrides))

/** Create a vendor-role user. */
const createVendorUser = (overrides = {}) =>
  createUser({ role: 'vendor', ...overrides })

/** Create an admin-role user. */
const createAdmin = (overrides = {}) =>
  createUser({ role: 'admin', ...overrides })

/** Create a logistics-role user. */
const createLogisticsUser = (overrides = {}) =>
  createUser({ role: 'logistics', ...overrides })

/**
 * Create a user and give them a wallet balance.
 * @param {number} balance  wallet_balance in XAF
 * @param {object} [overrides]
 */
const createUserWithBalance = (balance, overrides = {}) =>
  createUser({ wallet_balance: balance, ...overrides })

module.exports = {
  DEFAULT_PASSWORD,
  buildUser,
  createUser,
  createVendorUser,
  createAdmin,
  createLogisticsUser,
  createUserWithBalance,
}
