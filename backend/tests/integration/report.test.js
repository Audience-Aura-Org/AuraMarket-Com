'use strict'
/**
 * tests/integration/report.test.js
 * Prompt 13 — Abuse / fraud report submission.
 *
 * Sections:
 *   1. POST /reports — submit a report (auth, validation, success)
 */

const request   = require('supertest')
const mongoose  = require('mongoose')

const { buildApp }              = require('../setup/app')
const { createUser, createAdmin } = require('../factories')
const { signToken, authHeader } = require('../helpers/auth')

const Report = require('../../models/Report.model')

let app
beforeAll(() => { app = buildApp() })

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Valid report payload against a user target. */
const reportPayload = (targetId, overrides = {}) => ({
  target_id:   targetId.toString(),
  target_type: 'user',
  reason:      'scam_fraud',
  description: 'This user attempted to conduct a fraudulent transaction.',
  ...overrides,
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /reports
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /reports — submit an abuse report', () => {
  it('creates a pending report and returns 201', async () => {
    const reporter = await createUser()
    const target   = await createUser()

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(signToken(reporter)))
      .send(reportPayload(target._id))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.report.status).toBe('pending')
    expect(res.body.data.report.reporter_id.toString()).toBe(reporter._id.toString())
    expect(res.body.data.report.reason).toBe('scam_fraud')
  })

  it('stores the correct target_type in the DB', async () => {
    const reporter = await createUser()
    const targetId = new mongoose.Types.ObjectId()

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(signToken(reporter)))
      .send(reportPayload(targetId, { target_type: 'product', reason: 'prohibited_item' }))

    expect(res.status).toBe(201)
    expect(res.body.data.report.target_type).toBe('product')

    const saved = await Report.findById(res.body.data.report._id)
    expect(saved).not.toBeNull()
    expect(saved.target_type).toBe('product')
  })

  it('returns 400 when reason is not a valid enum value', async () => {
    const reporter = await createUser()
    const target   = await createUser()

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(signToken(reporter)))
      .send(reportPayload(target._id, { reason: 'invalid_reason' }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when target_type is not a valid enum value', async () => {
    const reporter = await createUser()
    const target   = await createUser()

    const res = await request(app)
      .post('/api/v1/reports')
      .set(authHeader(signToken(reporter)))
      .send(reportPayload(target._id, { target_type: 'post' }))

    expect(res.status).toBe(400)
  })

  it('returns 401 without authentication', async () => {
    const target = await createUser()

    const res = await request(app)
      .post('/api/v1/reports')
      .send(reportPayload(target._id))

    expect(res.status).toBe(401)
  })
})
