'use strict'
/**
 * tests/factories/product.factory.js
 * Factory for Product documents.
 */

const { faker } = require('@faker-js/faker')
const Product  = require('../../models/Product.model')
const { createVendor } = require('./vendor.factory')
const { createCategory } = require('./category.factory')

/**
 * Build a plain Product object (not saved).
 * @param {string|import('mongoose').Types.ObjectId} vendorId  Vendor._id
 * @param {string} categoryName   Category string (legacy field)
 * @param {object} [overrides]
 */
const buildProduct = (vendorId, categoryName, overrides = {}) => ({
  vendor_id:   vendorId,
  name:        faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  price:       Number(faker.commerce.price({ min: 500, max: 50_000 })),
  stock:       faker.number.int({ min: 1, max: 100 }),
  category:    categoryName,
  images:      [{ url: faker.image.url(), alt: faker.commerce.productName() }],
  is_active:   true,
  ...overrides,
})

/**
 * Create a Product with a freshly created Vendor and Category.
 * @param {object} [overrides]
 * @returns {Promise<{ product, vendor, user, category }>}
 */
const createProduct = async (overrides = {}) => {
  const { vendor, user } = await createVendor()
  const category         = await createCategory()
  const product = await Product.create(
    buildProduct(vendor._id, category.name, {
      category_id: category._id,
      ...overrides,
    })
  )
  return { product, vendor, user, category }
}

/**
 * Create a Product for an existing vendor.
 * @param {import('mongoose').Types.ObjectId} vendorId
 * @param {string} [categoryName]
 * @param {object} [overrides]
 */
const createProductForVendor = async (vendorId, categoryName = 'Test', overrides = {}) =>
  Product.create(buildProduct(vendorId, categoryName, overrides))

module.exports = { buildProduct, createProduct, createProductForVendor }
