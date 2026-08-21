'use strict'
/**
 * tests/integration/authorization.test.js
 * Prompt 3 — Role-based access control (RBAC) regression suite.
 *
 * Strategy: table-driven. Each row defines:
 *   { method, path, role, expectedStatus }
 *
 * "expectedStatus" for admin-only routes is 403 when the caller is non-admin,
 * and "not 403" when the caller IS admin (controller may return 200/400/404 but
 * must never 403 the admin).
 *
 * Routes under test (cross-referenced with MATRIX.md):
 *   Admin-only:
 *     GET  /api/v1/wallet/admin/stats
 *     GET  /api/v1/wallet/admin/withdrawals
 *     GET  /api/v1/escrow/logs
 *     GET  /api/v1/disputes/admin
 *
 *   Vendor-only:
 *     GET  /api/v1/wallet/escrow       (vendor only — customer → 403)
 *     GET  /api/v1/vendor/orders       (vendor + active subscription → customer → 403)
 *     GET  /api/v1/orders/vendor-orders (vendor + active subscription → customer → 403)
 *
 *   Buyer-only (customer | vendor | logistics — admin excluded):
 *     GET  /api/v1/orders/my-orders    (admin → 403)
 *
 *   Any authenticated user:
 *     GET  /api/v1/wallet             (every role → 200)
 */

const request = require('supertest')

const { buildApp }                                   = require('../setup/app')
const { createUser, createAdmin, createVendorUser,
        createLogisticsUser }                        = require('../factories')
const { authHeader, signToken }                      = require('../helpers/auth')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let app
beforeAll(() => { app = buildApp() })

const req = (method, path, token) =>
  request(app)[method](path).set(authHeader(token))

// ─────────────────────────────────────────────────────────────────────────────
// 1. Admin-only endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('Admin-only endpoints — non-admin roles receive 403', () => {
  const ADMIN_ONLY = [
    { method: 'get', path: '/api/v1/wallet/admin/stats' },
    { method: 'get', path: '/api/v1/wallet/admin/withdrawals' },
    { method: 'get', path: '/api/v1/escrow/logs' },
    { method: 'get', path: '/api/v1/disputes/admin' },
  ]

  for (const { method, path } of ADMIN_ONLY) {
    describe(`${method.toUpperCase()} ${path}`, () => {
      it('customer → 403', async () => {
        const user = await createUser({ role: 'customer', verification_status: 'verified' })
        const res  = await req(method, path, signToken(user))
        expect(res.status).toBe(403)
      })

      it('vendor → 403', async () => {
        const user = await createVendorUser({ verification_status: 'verified' })
        const res  = await req(method, path, signToken(user))
        expect(res.status).toBe(403)
      })

      it('logistics → 403', async () => {
        const user = await createLogisticsUser({ verification_status: 'verified' })
        const res  = await req(method, path, signToken(user))
        expect(res.status).toBe(403)
      })

      it('admin → NOT 403', async () => {
        const admin = await createAdmin({ verification_status: 'verified' })
        const res   = await req(method, path, signToken(admin))
        expect(res.status).not.toBe(403)
      })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vendor-only endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('Vendor-only endpoints — customer/logistics/admin receive 403', () => {
  // /wallet/escrow is vendor-only via restrictTo('vendor')
  // /orders/vendor-orders is vendor-only via restrictTo('vendor') + requireActiveSubscription + loadVendor
  const VENDOR_ONLY = [
    { method: 'get', path: '/api/v1/wallet/escrow' },
    { method: 'get', path: '/api/v1/orders/vendor-orders' },
  ]

  for (const { method, path } of VENDOR_ONLY) {
    describe(`${method.toUpperCase()} ${path}`, () => {
      it('customer → 403', async () => {
        const user = await createUser({ role: 'customer', verification_status: 'verified' })
        const res  = await req(method, path, signToken(user))
        expect(res.status).toBe(403)
      })

      it('admin → 403', async () => {
        const admin = await createAdmin({ verification_status: 'verified' })
        const res   = await req(method, path, signToken(admin))
        expect(res.status).toBe(403)
      })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Buyer endpoints (customer | vendor | logistics)
// ─────────────────────────────────────────────────────────────────────────────

describe('Buyer-only endpoints — admin is excluded', () => {
  it('GET /orders/my-orders — admin → 403', async () => {
    const admin = await createAdmin({ verification_status: 'verified' })
    const res   = await req('get', '/api/v1/orders/my-orders', signToken(admin))
    expect(res.status).toBe(403)
  })

  it('GET /orders/my-orders — customer → NOT 403', async () => {
    const user = await createUser({ role: 'customer', verification_status: 'verified' })
    const res  = await req('get', '/api/v1/orders/my-orders', signToken(user))
    expect(res.status).not.toBe(403)
  })

  it('GET /orders/my-orders — vendor → NOT 403', async () => {
    const user = await createVendorUser({ verification_status: 'verified' })
    const res  = await req('get', '/api/v1/orders/my-orders', signToken(user))
    expect(res.status).not.toBe(403)
  })

  it('GET /orders/my-orders — logistics → NOT 403', async () => {
    const user = await createLogisticsUser({ verification_status: 'verified' })
    const res  = await req('get', '/api/v1/orders/my-orders', signToken(user))
    expect(res.status).not.toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Any-authenticated endpoints — unauthenticated → 401
// ─────────────────────────────────────────────────────────────────────────────

describe('Protected endpoints reject unauthenticated requests with 401', () => {
  const PROTECTED = [
    { method: 'get',   path: '/api/v1/auth/me' },
    { method: 'get',   path: '/api/v1/wallet' },
    { method: 'get',   path: '/api/v1/wallet/transactions' },
    { method: 'get',   path: '/api/v1/disputes/customer' },
  ]

  for (const { method, path } of PROTECTED) {
    it(`${method.toUpperCase()} ${path} without token → 401`, async () => {
      const res = await request(app)[method](path)
      expect(res.status).toBe(401)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Escrow role-gating
// ─────────────────────────────────────────────────────────────────────────────

describe('Escrow — role-gating', () => {
  it('GET /escrow/logs — vendor → 403', async () => {
    const user = await createVendorUser({ verification_status: 'verified' })
    const res  = await req('get', '/api/v1/escrow/logs', signToken(user))
    expect(res.status).toBe(403)
  })

  it('POST /escrow/confirm-delivery/:id — customer → 403', async () => {
    const user = await createUser({ role: 'customer', verification_status: 'verified' })
    const res  = await request(app)
      .post('/api/v1/escrow/confirm-delivery/000000000000000000000001')
      .set(authHeader(signToken(user)))
    expect(res.status).toBe(403)
  })
})
