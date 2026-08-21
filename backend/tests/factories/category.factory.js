'use strict'
/**
 * tests/factories/category.factory.js
 * Factory for Category documents.
 */

const { faker } = require('@faker-js/faker')
const slugify = require('slugify')
const Category = require('../../models/Category.model')

const buildCategory = (overrides = {}) => {
  const name = faker.commerce.department() + ' ' + faker.string.alphanumeric(4)
  return {
    name,
    slug:        slugify(name, { lower: true, strict: true }),
    description: faker.lorem.sentence(),
    is_active:   true,
    ...overrides,
  }
}

const createCategory = async (overrides = {}) =>
  Category.create(buildCategory(overrides))

module.exports = { buildCategory, createCategory }
