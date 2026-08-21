'use strict'
/**
 * tests/factories/shipment.factory.js
 * Factory for Shipment documents.
 */

const Shipment = require('../../models/Shipment.model')

const buildShipment = (ids, overrides = {}) => ({
  order_id:  ids.orderId,
  vendor_id: ids.vendorId,
  status:    'pending',
  ...overrides,
})

const createShipment = async (ids, overrides = {}) =>
  Shipment.create(buildShipment(ids, overrides))

module.exports = { buildShipment, createShipment }
