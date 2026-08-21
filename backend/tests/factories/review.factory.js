'use strict'
const { faker } = require('@faker-js/faker')
const Review = require('../../models/Review.model')

const buildReview = (ids, overrides = {}) => ({
  user_id:    ids.userId,
  vendor_id:  ids.vendorId,
  product_id: ids.productId,
  order_id:   ids.orderId,
  rating:     faker.number.int({ min: 1, max: 5 }),
  comment:    faker.lorem.paragraph(),
  ...overrides,
})

const createReview = async (ids, overrides = {}) =>
  Review.create(buildReview(ids, overrides))

module.exports = { buildReview, createReview }
