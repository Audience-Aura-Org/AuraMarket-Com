'use strict'
const { faker } = require('@faker-js/faker')
const Cart = require('../../models/Cart.model')

const buildCartItem = (productId, vendorId, overrides = {}) => ({
  product_id: productId,
  vendor_id:  vendorId,
  quantity:   faker.number.int({ min: 1, max: 5 }),
  price:      faker.number.int({ min: 500, max: 20_000 }),
  ...overrides,
})

const buildCart = (userId, items = [], overrides = {}) => ({
  user_id: userId,
  items,
  ...overrides,
})

const createCart = async (userId, items = [], overrides = {}) =>
  Cart.create(buildCart(userId, items, overrides))

module.exports = { buildCartItem, buildCart, createCart }
