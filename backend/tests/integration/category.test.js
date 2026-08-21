'use strict'
/**
 * tests/integration/category.test.js
 * Prompt 11 — Category flows: public list, surface filtering, admin CRUD.
 *
 * Sections:
 *   1. GET /categories              — public list (retail surface)
 *   2. GET /categories?applies_to=  — surface filtering (restaurant vs retail)
 *   3. POST /categories             — admin creates a category
 *   4. DELETE /categories/:id       — admin deletes a category
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }                        = require('../setup/app')
const { createUser, createAdmin,
        createCategory }                  = require('../factories')
const { signToken, authHeader }           = require('../helpers/auth')

const Category = require('../../models/Category.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────
let admin, customer

beforeEach(async () => {
  admin    = await createAdmin()
  customer = await createUser()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /categories — public list
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /categories — public category list', () => {
  it('returns an empty list when no active categories exist', async () => {
    const res = await request(app).get('/api/v1/categories')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns active retail categories without authentication', async () => {
    await createCategory({ applies_to: 'retail', is_active: true })

    const res = await request(app).get('/api/v1/categories')

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('excludes inactive categories', async () => {
    await createCategory({ applies_to: 'retail', is_active: false })

    const res = await request(app).get('/api/v1/categories')

    const inactiveCount = res.body.data.filter(c => !c.is_active).length
    expect(inactiveCount).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /categories?applies_to= — surface filtering
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /categories — surface filtering', () => {
  it('filters to restaurant categories when applies_to=restaurant', async () => {
    await createCategory({ applies_to: 'retail',     is_active: true })
    await createCategory({ applies_to: 'restaurant', is_active: true })

    const res = await request(app).get('/api/v1/categories?applies_to=restaurant')

    expect(res.status).toBe(200)
    // All returned categories should apply to restaurant surface
    res.body.data.forEach(c => {
      expect(['restaurant', 'both']).toContain(c.applies_to)
    })
  })

  it('shows all categories (including restaurant) when applies_to=all', async () => {
    await createCategory({ applies_to: 'retail',     is_active: true })
    await createCategory({ applies_to: 'restaurant', is_active: true })

    const res = await request(app).get('/api/v1/categories?applies_to=all')

    expect(res.status).toBe(200)
    const hasRetail     = res.body.data.some(c => c.applies_to === 'retail')
    const hasRestaurant = res.body.data.some(c => c.applies_to === 'restaurant')
    expect(hasRetail).toBe(true)
    expect(hasRestaurant).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /categories — admin create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /categories — admin creates a category', () => {
  it('creates a new category and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(authHeader(signToken(admin)))
      .send({ name: 'Fresh Electronics', slug: 'fresh-electronics', applies_to: 'retail' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('Fresh Electronics')
  })

  it('returns 403 when a customer tries to create a category', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(authHeader(signToken(customer)))
      .send({ name: 'Hack Category', slug: 'hack-category' })

    expect(res.status).toBe(403)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .send({ name: 'No Auth', slug: 'no-auth' })

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE /categories/:id — admin delete
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /categories/:id — admin deletes a category', () => {
  it('deletes a category and returns 200', async () => {
    const cat = await createCategory({ applies_to: 'retail' })

    const res = await request(app)
      .delete(`/api/v1/categories/${cat._id}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const deleted = await Category.findById(cat._id)
    expect(deleted).toBeNull()
  })

  it('returns 404 for a non-existent category', async () => {
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/categories/${fakeId}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a customer tries to delete a category', async () => {
    const cat = await createCategory()

    const res = await request(app)
      .delete(`/api/v1/categories/${cat._id}`)
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(403)
  })
})
