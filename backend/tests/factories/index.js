'use strict'
/**
 * tests/factories/index.js
 * Barrel — re-exports all factories for convenient destructuring.
 *
 * Usage:
 *   const { createUser, createVendor, createProduct } = require('../factories')
 */

module.exports = {
  ...require('./user.factory'),
  ...require('./vendor.factory'),
  ...require('./category.factory'),
  ...require('./product.factory'),
  ...require('./order.factory'),
  ...require('./transaction.factory'),
  ...require('./escrow.factory'),
  ...require('./dispute.factory'),
  ...require('./shipment.factory'),
  ...require('./coupon.factory'),
  ...require('./notification.factory'),
  ...require('./review.factory'),
  ...require('./withdrawal.factory'),
  ...require('./message.factory'),
  ...require('./cart.factory'),
  ...require('./subscriptionPlan.factory'),
}
