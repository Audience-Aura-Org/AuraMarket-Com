'use strict'
/**
 * tests/factories/dispute.factory.js
 * Factory for Dispute documents.
 */

const { faker } = require('@faker-js/faker')
const Dispute = require('../../models/Dispute.model')

const buildDispute = (ids, overrides = {}) => ({
  order_id:    ids.orderId,
  reporter_id: ids.reporterId,
  vendor_id:   ids.vendorId,
  reason:      faker.lorem.sentence(),
  status:      'open',
  ...overrides,
})

const createDispute = async (ids, overrides = {}) =>
  Dispute.create(buildDispute(ids, overrides))

module.exports = { buildDispute, createDispute }
