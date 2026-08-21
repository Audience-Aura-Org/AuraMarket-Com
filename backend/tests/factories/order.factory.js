'use strict'
/**
 * tests/factories/order.factory.js
 * Factory for Order documents.
 */

const { faker } = require('@faker-js/faker')
const Order = require('../../models/Order.model')

/**
 * Build a plain Order object (not saved).
 * @param {object} ids  { customerId, vendorId, productId }
 * @param {object} [overrides]
 */
const buildOrder = ({ customerId, vendorId, productId }, overrides = {}) => {
  const price    = faker.number.int({ min: 500, max: 20_000 })
  const quantity = faker.number.int({ min: 1, max: 5 })
  const subtotal = price * quantity
  return {
    customer_id:    customerId,
    vendor_id:      vendorId,
    products: [{
      product_id:    productId || new (require('mongoose').Types.ObjectId)(),
      name:          faker.commerce.productName(),
      quantity,
      price,
      regular_price: price,
    }],
    subtotal,
    shipping_fee:   0,
    total_amount:   subtotal,
    payment_method: 'wallet',
    status:         'pending',
    payment_status: 'pending',
    ...overrides,
  }
}

/**
 * Create and save an Order.
 */
const createOrder = async (ids, overrides = {}) =>
  Order.create(buildOrder(ids, overrides))

/**
 * Create a completed (paid) order.
 */
const createCompletedOrder = (ids, overrides = {}) =>
  createOrder(ids, {
    status:         'delivered',
    payment_status: 'paid',
    ...overrides,
  })

module.exports = { buildOrder, createOrder, createCompletedOrder }
