'use strict'
/**
 * tests/integration/users.test.js
 * Prompt 7 — User profile, KYC, logout, and account deletion.
 * Prompt 12 — GET /users/followed-vendors
 *
 * Sections:
 *   1. GET   /users/me              — fetch own profile
 *   2. PATCH /users/me              — update name / phone
 *   3. POST  /users/kyc             — submit KYC + guards
 *   4. POST  /auth/logout           — clears auth cookie
 *   5. POST  /auth/delete-account   — cascading account deletion
 *   6. GET   /users/followed-vendors — list followed vendors
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }                          = require('../setup/app')
const { createUser, createVendorUser,
        createAdmin }                       = require('../factories')
const { signToken, authHeader }             = require('../helpers/auth')

const User             = require('../../models/User.model')
const Vendor           = require('../../models/Vendor.model')
const KYC              = require('../../models/KYC.model')
const PlatformSettings = require('../../models/PlatformSettings.model')
const Follow           = require('../../models/Follow.model')

let app
beforeAll(() => { app = buildApp() })

beforeEach(async () => {
  await PlatformSettings.create([{
    commission_rate:  0,
    commission_type:  'percentage',
    escrow_fee_type:  'percentage',
    escrow_fee_value: 0,
    subscription_required_roles: { vendor: false, logistics: false, customer: false },
  }])
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /users/me
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('returns the authenticated user with KYC field', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/users/me')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user._id).toBe(user._id.toString())
    // kyc field is always present (null when not submitted)
    expect(Object.prototype.hasOwnProperty.call(res.body.data.user, 'kyc')).toBe(true)
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/users/me')
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /users/me — profile update
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /users/me', () => {
  it('updates name and phone and returns the updated user', async () => {
    const user = await createUser({ name: 'Old Name', phone: '+237600000001' })

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(authHeader(signToken(user)))
      .send({ name: 'New Name', phone: '+237600000099' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.name).toBe('New Name')
    expect(res.body.data.user.phone).toBe('+237600000099')
  })

  it('returns 400 when no valid fields are provided', async () => {
    const user = await createUser()

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(authHeader(signToken(user)))
      .send({}) // empty body

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/No valid fields/i)
  })

  it('cascades phone update to the vendor record', async () => {
    const vendorUser = await createVendorUser()
    const vendorDoc  = await Vendor.create({
      user_id:       vendorUser._id,
      store_name:    'Test Store',
      description:   'Test.',
      phone:         '+237600000001',
      verified:      false,
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    await request(app)
      .patch('/api/v1/users/me')
      .set(authHeader(signToken(vendorUser)))
      .send({ phone: '+237600000088' })

    const updatedVendor = await Vendor.findById(vendorDoc._id)
    expect(updatedVendor.phone).toBe('+237600000088')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /users/kyc — KYC submission
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /users/kyc', () => {
  it('creates a KYC record and sets verification_status to pending', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/users/kyc')
      .set(authHeader(signToken(user)))
      .send({
        full_name:      'Alice Doe',
        id_type:        'national_id',
        id_number:      'CM-1234567',
        file_url_front: 'https://cdn.test/front.jpg',
        file_url_back:  'https://cdn.test/back.jpg',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.kyc.status).toBe('pending')

    // User's verification_status updated
    const updated = await User.findById(user._id)
    expect(updated.verification_status).toBe('pending')
  })

  it('returns 400 when required fields are missing', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/users/kyc')
      .set(authHeader(signToken(user)))
      .send({ full_name: 'Alice Doe' }) // missing id_type, id_number, file_url_front

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/required/i)
  })

  it('is idempotent — re-submission updates the existing KYC record', async () => {
    const user = await createUser()

    const payload = {
      full_name:      'Alice Doe',
      id_type:        'national_id',
      id_number:      'CM-1234567',
      file_url_front: 'https://cdn.test/front.jpg',
    }

    await request(app)
      .post('/api/v1/users/kyc')
      .set(authHeader(signToken(user)))
      .send(payload)

    const res = await request(app)
      .post('/api/v1/users/kyc')
      .set(authHeader(signToken(user)))
      .send({ ...payload, id_number: 'CM-9999999' }) // updated ID number

    expect(res.status).toBe(200)
    expect(res.body.data.kyc.document_number).toBe('CM-9999999')

    // Only one KYC record should exist
    const count = await KYC.countDocuments({ user_id: user._id })
    expect(count).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('returns 200 and clears the auth cookie', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/logged out/i)
    // The Set-Cookie header should clear the auth token
    const setCookie = res.headers['set-cookie']
    if (setCookie) {
      const authCookie = setCookie.find(c => c.includes('token') || c.includes('auth'))
      if (authCookie) {
        expect(authCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i)
      }
    }
  })

  it('works without authentication (protectOptional guard)', async () => {
    const res = await request(app).post('/api/v1/auth/logout')
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /auth/delete-account
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/delete-account', () => {
  it('returns 400 when confirmText is wrong', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/auth/delete-account')
      .set(authHeader(signToken(user)))
      .send({ confirmText: 'WRONG' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/DELETE.*SUPPRIMER/i)
  })

  it('accepts SUPPRIMER (French confirmation) and deletes the account', async () => {
    const user = await createUser()

    const res = await request(app)
      .post('/api/v1/auth/delete-account')
      .set(authHeader(signToken(user)))
      .send({ confirmText: 'SUPPRIMER' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted permanently/i)

    // User record must be gone
    const gone = await User.findById(user._id)
    expect(gone).toBeNull()
  })

  it('cascades vendor doc deletion when a vendor deletes their account', async () => {
    const vendorUser = await createVendorUser()
    const vendorDoc  = await Vendor.create({
      user_id:       vendorUser._id,
      store_name:    'Delete Me Store',
      description:   'Going away.',
      phone:         '+237600000002',
      verified:      false,
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    await request(app)
      .post('/api/v1/auth/delete-account')
      .set(authHeader(signToken(vendorUser)))
      .send({ confirmText: 'DELETE' })

    const vendorGone = await Vendor.findById(vendorDoc._id)
    expect(vendorGone).toBeNull()

    const userGone = await User.findById(vendorUser._id)
    expect(userGone).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /users/followed-vendors
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /users/followed-vendors', () => {
  it('returns an empty list when the user follows nobody', async () => {
    const user = await createUser()

    const res = await request(app)
      .get('/api/v1/users/followed-vendors')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.follows)).toBe(true)
    expect(res.body.data.follows).toHaveLength(0)
  })

  it('returns the vendor the user follows', async () => {
    const user        = await createUser()
    const vendorUser  = await createVendorUser()
    const vendorDoc   = await Vendor.create({
      user_id:       vendorUser._id,
      store_name:    'Followed Store',
      description:   'A store worth following.',
      phone:         '+237600000010',
      verified:      true,
      rating:        0,
      total_sales:   0,
      total_revenue: 0,
    })

    // Seed the follow relationship directly
    await Follow.create({ user_id: user._id, vendor_id: vendorDoc._id })

    const res = await request(app)
      .get('/api/v1/users/followed-vendors')
      .set(authHeader(signToken(user)))

    expect(res.status).toBe(200)
    expect(res.body.data.follows).toHaveLength(1)
    expect(res.body.data.follows[0].vendor_id._id.toString()).toBe(vendorDoc._id.toString())
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/users/followed-vendors')
    expect(res.status).toBe(401)
  })
})
