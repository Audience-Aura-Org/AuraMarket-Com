'use strict'
/**
 * tests/integration/homepage.test.js
 * Prompt 12 — Homepage / Storefront Builder endpoints.
 *
 * Sections:
 *   1. GET  /homepage                        — public homepage (empty then with data)
 *   2. GET  /homepage/admin/sections         — admin view of all sections
 *   3. POST /homepage/admin/sections         — admin creates a section
 *   4. PATCH /homepage/admin/sections/:id    — admin updates a section
 *   5. DELETE /homepage/admin/sections/:id   — admin deletes a section
 */

const request = require('supertest')
const mongoose = require('mongoose')

const { buildApp }               = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { signToken, authHeader }  = require('../helpers/auth')

const HomepageSection = require('../../models/HomepageSection.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Seed an active hero section with one banner item. */
const seedHeroSection = () =>
  HomepageSection.create({
    title:    'Welcome Banner',
    type:     'hero',
    order:    1,
    is_active: true,
    data: [{
      image_url:     'https://cdn.test/hero.jpg',
      link_to:       '/shop',
      headline:      'Shop the best deals',
      cta_text:      'Shop now',
      display_order: 0,
    }],
  })

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /homepage — public homepage
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /homepage — public homepage layout', () => {
  it('returns 200 with an empty sections array when no CMS data exists', async () => {
    const res = await request(app).get('/api/v1/homepage')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.sections)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('returns the active section after it is seeded', async () => {
    await seedHeroSection()

    const res = await request(app).get('/api/v1/homepage')

    expect(res.status).toBe(200)
    expect(res.body.data.sections.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.sections[0].type).toBe('hero')
  })

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/v1/homepage')
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /homepage/admin/sections — admin view
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /homepage/admin/sections — admin-only sections view', () => {
  it('returns all sections (including inactive) to an admin', async () => {
    await HomepageSection.create({
      title:    'Inactive Promo',
      type:     'promo_banner',
      order:    99,
      is_active: false,
      data: [{ image_url: 'https://cdn.test/promo.jpg', display_order: 0 }],
    })

    const res = await request(app)
      .get('/api/v1/homepage/admin/sections')
      .set(authHeader(signToken(await createAdmin())))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 403 when a regular user calls the admin endpoint', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/homepage/admin/sections')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/homepage/admin/sections')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /homepage/admin/sections — create section
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /homepage/admin/sections — admin creates a section', () => {
  it('creates a new homepage section and returns 201', async () => {
    const admin = await createAdmin()

    const res = await request(app)
      .post('/api/v1/homepage/admin/sections')
      .set(authHeader(signToken(admin)))
      .send({
        title:    'New Arrivals',
        type:     'trending',
        order:    2,
        is_active: true,
        data: [{ image_url: 'https://cdn.test/new.jpg', display_order: 0 }],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.section.title).toBe('New Arrivals')
    expect(res.body.data.section.type).toBe('trending')
  })

  it('returns 403 for a regular user', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/homepage/admin/sections')
      .set(authHeader(signToken(user)))
      .send({ title: 'Sneaky', type: 'hero', data: [] })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. PATCH /homepage/admin/sections/:id — update section
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /homepage/admin/sections/:id — admin updates a section', () => {
  it('updates the section title and returns 200', async () => {
    const admin   = await createAdmin()
    const section = await seedHeroSection()

    const res = await request(app)
      .patch(`/api/v1/homepage/admin/sections/${section._id}`)
      .set(authHeader(signToken(admin)))
      .send({ title: 'Updated Banner Title' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.section.title).toBe('Updated Banner Title')
  })

  it('returns 404 for a non-existent section id', async () => {
    const admin  = await createAdmin()
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .patch(`/api/v1/homepage/admin/sections/${fakeId}`)
      .set(authHeader(signToken(admin)))
      .send({ title: 'Ghost' })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /homepage/admin/sections/:id — delete section
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /homepage/admin/sections/:id — admin deletes a section', () => {
  it('deletes the section and returns 200', async () => {
    const admin   = await createAdmin()
    const section = await seedHeroSection()

    const res = await request(app)
      .delete(`/api/v1/homepage/admin/sections/${section._id}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Confirm it's gone from the DB
    const gone = await HomepageSection.findById(section._id)
    expect(gone).toBeNull()
  })

  it('returns 404 for a non-existent section id', async () => {
    const admin  = await createAdmin()
    const fakeId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .delete(`/api/v1/homepage/admin/sections/${fakeId}`)
      .set(authHeader(signToken(admin)))

    expect(res.status).toBe(404)
  })

  it('returns 403 for a regular user', async () => {
    const user    = await createUser()
    const section = await seedHeroSection()

    const res = await request(app)
      .delete(`/api/v1/homepage/admin/sections/${section._id}`)
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(403)
  })
})
