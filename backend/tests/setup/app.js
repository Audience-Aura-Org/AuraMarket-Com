'use strict'
/**
 * tests/setup/app.js
 * Builds the Auradime Express app for use with supertest.
 *
 * Mirrors server.js middleware + route stack WITHOUT:
 *   - server.listen()
 *   - Background worker start-up calls
 *   - Socket.io initialisation (not needed for HTTP tests)
 *   - validateEnv() (env vars are set by globalSetup.js)
 *   - SMTP verification
 *
 * Usage in a test file:
 *   const { buildApp } = require('../setup/app')
 *   const request = require('supertest')
 *
 *   let app
 *   beforeAll(() => { app = buildApp() })
 *
 *   it('GET /api/health → 200', async () => {
 *     await request(app).get('/api/health').expect(200)
 *   })
 */

const express     = require('express')
const cors        = require('cors')
const compression = require('compression')

// ── lazy singleton ───────────────────────────────────────────────────────────
let _app = null

/**
 * Returns a cached Express app suitable for supertest.
 * Must be called after Mongoose is connected (i.e., inside beforeAll or a test).
 *
 * @returns {import('express').Application}
 */
function buildApp() {
  if (_app) return _app

  const { createCorsOptions, sanitizeInput, securityHeaders } =
    require('../../middleware/security.middleware')
  const setLocale    = require('../../middleware/locale.middleware')
  const { apiLimiter } = require('../../middleware/rateLimiter')
  const notFound     = require('../../middleware/notFound')
  const errorHandler = require('../../middleware/errorHandler')

  const app = express()
  app.set('trust proxy', 1)

  // ── CORS / security headers ────────────────────────────────────────────────
  app.options(/\/.*/, cors(createCorsOptions()))
  app.use(securityHeaders)
  app.use(cors(createCorsOptions()))
  app.use(compression())

  // ── Eversend raw body (before express.json — required for HMAC) ───────────
  const { eversendWebhook } = require('../../controllers/payment.controller')
  app.post(
    '/api/v1/payments/eversend/webhook',
    express.raw({ type: 'application/json' }),
    eversendWebhook
  )
  app.post(
    '/api/payments/eversend/webhook',
    express.raw({ type: 'application/json' }),
    eversendWebhook
  )

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  app.use((req, res, next) => {
    if (/^\/api(\/v1)?\/payments\/.*webhook/.test(req.path)) return next()
    return sanitizeInput(req, res, next)
  })

  // ── Rate limiting (memory store in tests — Redis is disabled) ─────────────
  app.use('/api', apiLimiter)

  // ── Locale ────────────────────────────────────────────────────────────────
  app.use(setLocale)

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) =>
    res.status(200).json({ success: true, message: 'OK (test)' })
  )

  // ── API routes ────────────────────────────────────────────────────────────
  const v1Router = require('../../routes/v1.router')
  app.use('/api/v1', v1Router)
  app.use('/api',    v1Router)

  // ── Error handlers (must be last) ─────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  _app = app
  return app
}

/**
 * Reset the cached app — call in afterAll if you need a fresh instance
 * across multiple test files (usually not needed with pool: 'forks').
 */
function resetApp() {
  _app = null
}

module.exports = { buildApp, resetApp }
