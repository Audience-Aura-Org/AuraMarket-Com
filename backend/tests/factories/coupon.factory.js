'use strict'
/**
 * tests/factories/coupon.factory.js
 * Factory for Coupon documents.
 */

const { faker } = require('@faker-js/faker')
const Coupon = require('../../models/Coupon.model')

const buildCoupon = (overrides = {}) => ({
  code:          faker.string.alphanumeric(8).toUpperCase(),
  discount_type: 'percentage',
  discount_value: faker.number.int({ min: 5, max: 50 }),
  min_order_amount: 0,
  max_uses:      100,
  used_count:    0,
  is_active:     true,
  expiry_date:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days — field name matches Coupon model
  ...overrides,
})

const createCoupon = async (overrides = {}) =>
  Coupon.create(buildCoupon(overrides))

module.exports = { buildCoupon, createCoupon }
