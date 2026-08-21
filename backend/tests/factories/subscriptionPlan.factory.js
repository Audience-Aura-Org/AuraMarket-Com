'use strict'
const { faker } = require('@faker-js/faker')
const SubscriptionPlan = require('../../models/SubscriptionPlan.model')

const buildSubscriptionPlan = (overrides = {}) => ({
  name:           faker.commerce.productName(),
  price:          faker.number.int({ min: 500, max: 10_000 }),
  duration_days:  30,
  features:       [faker.lorem.words(3), faker.lorem.words(3)],
  is_active:      true,
  ...overrides,
})

const createSubscriptionPlan = async (overrides = {}) =>
  SubscriptionPlan.create(buildSubscriptionPlan(overrides))

module.exports = { buildSubscriptionPlan, createSubscriptionPlan }
