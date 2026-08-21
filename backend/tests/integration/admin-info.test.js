'use strict'
/**
 * tests/integration/admin-info.test.js
 * Prompt 20 — GET /auth/admin-info — platform support admin node.
 *
 * Sections:
 *   1. Happy path — returns admin node for any authenticated user
 *   2. Guard rails — unauthenticated request blocked
 */

const request    = require('supertest')
const mongoose   = require('mongoose')

const { buildApp }              = require('../setup/app')
const { createUser, createAdmin, createVendorUser } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/admin-info
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /auth/admin-info — platform admin node', () => {
  it('returns admin object for any authenticated user (customer)', async () => {
    await createAdmin()             // ensures at least one admin exists
    const customer = await createUser()

    const res = await request(app)
      .get('/api/v1/auth/admin-info')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('admin')
    expect(res.body.data.admin).toHaveProperty('role', 'admin')
  })

  it('returns admin object when called by a vendor', async () => {
    await createAdmin()
    const vendor = await createVendorUser()

    const res = await request(app)
      .get('/api/v1/auth/admin-info')
      .set(authHeader(signToken(vendor)))

    expect(res.status).toBe(200)
    expect(res.body.data.admin.role).toBe('admin')
  })

  it('admin node contains expected public fields', async () => {
    await createAdmin()
    const customer = await createUser()

    const res = await request(app)
      .get('/api/v1/auth/admin-info')
      .set(authHeader(signToken(customer)))

    expect(res.status).toBe(200)
    const { admin } = res.body.data
    // Sensitive fields must NOT be exposed
    expect(admin).not.toHaveProperty('password')
    expect(admin).not.toHaveProperty('token_version')
    // Public fields that should be present
    expect(admin).toHaveProperty('name')
    expect(admin).toHaveProperty('role')
  })

  it('blocks unauthenticated request with 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/admin-info')

    expect(res.status).toBe(401)
  })
})
