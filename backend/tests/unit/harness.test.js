'use strict'
/**
 * tests/unit/harness.test.js
 * Unit-project smoke test — proves the runner works without any DB.
 *
 * This file intentionally tests only pure functions and module structure
 * so the ENTIRE unit suite can run in milliseconds with no external deps.
 */

const { daysAgo, hoursAgo, inDays } = require('../helpers/time')
const { race, countOk, countFailed } = require('../helpers/concurrency')
const { eversendWebhookPayload, signEversendWebhook } = require('../helpers/gateways')
const { signToken, authHeader } = require('../helpers/auth')
const { getBalance } = require('../helpers/money')

// ── time helpers ─────────────────────────────────────────────────────────────

describe('time helpers', () => {
  it('daysAgo(1) is approximately 24h behind now', () => {
    const diff = Date.now() - daysAgo(1).getTime()
    expect(diff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 100)
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 100)
  })

  it('hoursAgo(2) is approximately 2h behind now', () => {
    const diff = Date.now() - hoursAgo(2).getTime()
    expect(diff).toBeCloseTo(2 * 60 * 60 * 1000, -2)
  })

  it('inDays(7) is in the future', () => {
    expect(inDays(7).getTime()).toBeGreaterThan(Date.now())
  })
})

// ── concurrency helpers ──────────────────────────────────────────────────────

describe('concurrency helpers', () => {
  it('race() settles all promises', async () => {
    let n = 0
    const results = await race(5, async () => { n++; return n })
    expect(results).toHaveLength(5)
    expect(countOk(results)).toBe(5)
    expect(countFailed(results)).toBe(0)
  })

  it('race() captures rejections without throwing', async () => {
    const results = await race(3, async () => {
      throw new Error('boom')
    })
    expect(countOk(results)).toBe(0)
    expect(countFailed(results)).toBe(3)
  })
})

// ── gateway helpers ──────────────────────────────────────────────────────────

describe('gateway helpers', () => {
  it('eversendWebhookPayload() builds a valid-looking payload', () => {
    const p = eversendWebhookPayload({ reference: 'REF-123', amount: 5000 })
    expect(p.type).toBe('transaction.success')
    expect(p.data.transactionRef).toBe('REF-123')
    expect(p.data.amount).toBe(5000)
  })

  it('signEversendWebhook() produces a hex HMAC-SHA512 signature (128 chars)', () => {
    const payload = eversendWebhookPayload()
    const { body, signature } = signEversendWebhook(payload, 'test-secret')
    expect(typeof body).toBe('string')
    expect(signature).toMatch(/^[0-9a-f]{128}$/)
  })
})

// ── auth helpers ─────────────────────────────────────────────────────────────

describe('auth helpers', () => {
  it('signToken() produces a 3-part JWT', () => {
    const mockUser = { _id: '507f1f77bcf86cd799439011', role: 'customer', token_version: 0 }
    const token = signToken(mockUser)
    expect(token.split('.')).toHaveLength(3)
  })

  it('authHeader() returns the correct object shape', () => {
    const h = authHeader('my-token')
    expect(h).toEqual({ Authorization: 'Bearer my-token' })
  })
})
