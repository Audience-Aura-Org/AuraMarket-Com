'use strict'
/**
 * tests/integration/vendor-analytics.test.js
 * Inventory counters on the vendor dashboard use the same stock rule as the
 * products page (web/lib/stock): variant products count the sum of their
 * variants; meals have no stock and are available while active.
 */

const request = require('supertest')
const mongoose = require('mongoose')

const { buildApp } = require('../setup/app')
const { createVendor } = require('../factories')
const { asUser } = require('../helpers/auth')
const Product = require('../../models/Product.model')
const PlatformSettings = require('../../models/PlatformSettings.model')

let app
beforeAll(() => { app = buildApp() })

let vendorUser, vendor
beforeEach(async () => {
  await PlatformSettings.create({ subscription_required_roles: { vendor: false, logistics: false, customer: false } })
  ;({ user: vendorUser, vendor } = await createVendor({ verified: true, is_onboarded: true }))
})

const raw = (doc) => Product.collection.insertOne({
  _id: new mongoose.Types.ObjectId(), vendor_id: vendor._id, name: 'P', description: 'd', price: 1000,
  category: 'General', images: [], status: 'active', createdAt: new Date(), updatedAt: new Date(), ...doc,
})

describe('GET /vendor/analytics — inventory', () => {
  it('counts variant stock and treats meals as available, not as stock items', async () => {
    await raw({ stock: 20 })                                                         // in stock
    await raw({ stock: 3 })                                                          // low
    await raw({ stock: 0 })                                                          // out
    await raw({ has_variants: true, stock: 50, sku_variants: [{ price: 1000, stock: 2 }, { price: 1000, stock: 1 }] }) // low (3), not 50
    await raw({ has_variants: true, stock: 9, sku_variants: [{ price: 1000, stock: 0 }] })                            // out, not 9
    await raw({ is_meal: true, stock: 0, meal: { booking_options: [{ type: 'delivery' }] } })                           // meal: available

    const res = await request(app).get('/api/v1/vendor/analytics').set(asUser(vendorUser))

    expect(res.status).toBe(200)
    const { stats } = res.body.data
    expect(stats.total_products).toBe(6)
    expect(stats.in_stock_products).toBe(4)      // 20, 3, variants(3), meal
    expect(stats.low_stock_count).toBe(2)        // 3, variants(3)
    expect(stats.out_of_stock_products).toBe(2)  // 0, variants(0)
  })
})
