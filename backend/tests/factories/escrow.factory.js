'use strict'
/**
 * tests/factories/escrow.factory.js
 * Factory for Escrow documents.
 */

const { faker } = require('@faker-js/faker')
const Escrow = require('../../models/Escrow.model')

const buildEscrow = (ids, overrides = {}) => ({
  order_id:   ids.orderId,
  vendor_id:  ids.vendorId,
  customer_id: ids.customerId,
  amount:     faker.number.int({ min: 500, max: 50_000 }),
  status:     'held',
  ...overrides,
})

const createEscrow = async (ids, overrides = {}) =>
  Escrow.create(buildEscrow(ids, overrides))

module.exports = { buildEscrow, createEscrow }
