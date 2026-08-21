'use strict'
const { faker } = require('@faker-js/faker')
const WithdrawalRequest = require('../../models/WithdrawalRequest.model')

const buildWithdrawal = (userId, overrides = {}) => ({
  user_id:       userId,
  amount:        faker.number.int({ min: 1000, max: 50_000 }),
  status:        'pending',
  payment_method: 'mobile_money',
  account_details: {
    phone:   faker.phone.number(),
    network: 'MTN',
  },
  ...overrides,
})

const createWithdrawal = async (userId, overrides = {}) =>
  WithdrawalRequest.create(buildWithdrawal(userId, overrides))

module.exports = { buildWithdrawal, createWithdrawal }
