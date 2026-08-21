'use strict'
const { faker } = require('@faker-js/faker')
const Message = require('../../models/Message.model')

const buildMessage = (ids, overrides = {}) => ({
  sender_id:   ids.senderId,
  receiver_id: ids.receiverId,
  content:     faker.lorem.sentence(),
  is_read:     false,
  ...overrides,
})

const createMessage = async (ids, overrides = {}) =>
  Message.create(buildMessage(ids, overrides))

module.exports = { buildMessage, createMessage }
