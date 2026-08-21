'use strict'
const { faker } = require('@faker-js/faker')
const Notification = require('../../models/Notification.model')

const buildNotification = (userId, overrides = {}) => ({
  user_id: userId,
  title:   faker.lorem.words(3),
  message: faker.lorem.sentence(),
  type:    'general',
  is_read: false,
  ...overrides,
})

const createNotification = async (userId, overrides = {}) =>
  Notification.create(buildNotification(userId, overrides))

module.exports = { buildNotification, createNotification }
