'use strict'
/**
 * tests/factories/vendor.factory.js
 * Factory for Vendor documents (always paired with a User).
 */

const { faker } = require('@faker-js/faker')
const Vendor = require('../../models/Vendor.model')
const { createVendorUser } = require('./user.factory')

/**
 * Build a plain Vendor object (not saved).
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [overrides]
 */
const buildVendor = (userId, overrides = {}) => ({
  user_id:    userId,
  store_name: faker.company.name().slice(0, 100),
  description: faker.lorem.sentence().slice(0, 500),
  phone:      faker.phone.number(),
  verified:   false,
  rating:     0,
  total_sales: 0,
  total_revenue: 0,
  ...overrides,
})

/**
 * Create a Vendor + its linked User in one call.
 * @param {{ user?: object, vendor?: object }} [overrides]
 * @returns {Promise<{ user: Document, vendor: Document }>}
 */
const createVendor = async (overrides = {}) => {
  const user   = await createVendorUser(overrides.user || {})
  const vendor = await Vendor.create(buildVendor(user._id, overrides.vendor || {}))
  return { user, vendor }
}

module.exports = { buildVendor, createVendor }
