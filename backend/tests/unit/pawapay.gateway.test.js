'use strict'

/**
 * tests/unit/pawapay.gateway.test.js
 * Unit tests for PawaPay gateway pure functions.
 * No MongoDB or network calls — tests normalizePhone, detectProvider,
 * normalizeStatus, formatAmount, verifyWebhookSignature, and checkCallerIp.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'

// PawaPay gateway exports all internal functions on the module object
const pawapay = require('../../services/payment/gateways/pawapay.gateway')

// ─────────────────────────────────────────────────────────────────────────────
// normalizePhone
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizePhone', () => {
  it('passes through a full MSISDN (237…)', () => {
    expect(pawapay.normalizePhone('237678901234')).toBe('237678901234')
  })

  it('strips leading + sign', () => {
    expect(pawapay.normalizePhone('+237678901234')).toBe('237678901234')
  })

  it('strips leading 00 international prefix', () => {
    expect(pawapay.normalizePhone('00237678901234')).toBe('237678901234')
  })

  it('prepends 237 to a local number starting with 6', () => {
    expect(pawapay.normalizePhone('678901234')).toBe('237678901234')
  })

  it('strips leading 0 before prepending 237', () => {
    expect(pawapay.normalizePhone('0678901234')).toBe('237678901234')
  })

  it('handles formatted numbers with spaces and dashes', () => {
    expect(pawapay.normalizePhone('+237 678-901-234')).toBe('237678901234')
  })

  it('handles parentheses in formatting', () => {
    expect(pawapay.normalizePhone('(237) 678 901 234')).toBe('237678901234')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// detectProvider
// ─────────────────────────────────────────────────────────────────────────────
describe('detectProvider', () => {
  it('detects MTN for 65x prefix', () => {
    expect(pawapay.detectProvider('237650000001')).toBe('MTN_MOMO_CMR')
    expect(pawapay.detectProvider('237659999999')).toBe('MTN_MOMO_CMR')
  })

  it('detects MTN for 67x prefix', () => {
    expect(pawapay.detectProvider('237670000001')).toBe('MTN_MOMO_CMR')
  })

  it('detects MTN for 68x prefix', () => {
    expect(pawapay.detectProvider('237680000001')).toBe('MTN_MOMO_CMR')
  })

  it('detects Orange for 69x prefix', () => {
    expect(pawapay.detectProvider('237690000001')).toBe('ORANGE_MONEY_CMR')
  })

  it('detects Orange for 62x prefix', () => {
    expect(pawapay.detectProvider('237620000001')).toBe('ORANGE_MONEY_CMR')
  })

  it('works with local numbers (no country code)', () => {
    expect(pawapay.detectProvider('690000001')).toBe('ORANGE_MONEY_CMR')
    expect(pawapay.detectProvider('650000001')).toBe('MTN_MOMO_CMR')
  })

  it('works with + prefix numbers', () => {
    expect(pawapay.detectProvider('+237690123456')).toBe('ORANGE_MONEY_CMR')
  })

  it('defaults to MTN for unknown prefixes', () => {
    expect(pawapay.detectProvider('237710000001')).toBe('MTN_MOMO_CMR')
  })
})

describe('isSupportedCameroonProvider', () => {
  it('allows the provider enabled for the live PawaPay account', () => {
    expect(pawapay.isSupportedCameroonProvider('MTN_MOMO_CMR')).toBe(true)
  })

  it('does not route Orange payments until Orange is enabled in PawaPay', () => {
    expect(pawapay.isSupportedCameroonProvider('ORANGE_MONEY_CMR')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// normalizeStatus (deposit/checkout)
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeStatus', () => {
  it('maps COMPLETED → SUCCESSFUL', () => {
    expect(pawapay.normalizeStatus('COMPLETED')).toBe('SUCCESSFUL')
  })

  it('maps FAILED → FAILED', () => {
    expect(pawapay.normalizeStatus('FAILED')).toBe('FAILED')
  })

  it('maps ACCEPTED → PENDING', () => {
    expect(pawapay.normalizeStatus('ACCEPTED')).toBe('PENDING')
  })

  it('maps DUPLICATE_IGNORED → DUPLICATE', () => {
    expect(pawapay.normalizeStatus('DUPLICATE_IGNORED')).toBe('DUPLICATE')
  })

  it('is case-insensitive', () => {
    expect(pawapay.normalizeStatus('completed')).toBe('SUCCESSFUL')
    expect(pawapay.normalizeStatus('Failed')).toBe('FAILED')
  })

  it('defaults to PENDING for unknown statuses', () => {
    expect(pawapay.normalizeStatus('SUBMITTED')).toBe('PENDING')
    expect(pawapay.normalizeStatus('')).toBe('PENDING')
    expect(pawapay.normalizeStatus(null)).toBe('PENDING')
    expect(pawapay.normalizeStatus(undefined)).toBe('PENDING')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// normalizePawaPayoutStatus (payout/disbursement)
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizePawaPayoutStatus', () => {
  it('maps COMPLETED → SUCCESSFUL', () => {
    expect(pawapay.normalizePawaPayoutStatus('COMPLETED')).toBe('SUCCESSFUL')
  })

  it('maps FAILED → FAILED', () => {
    expect(pawapay.normalizePawaPayoutStatus('FAILED')).toBe('FAILED')
  })

  it('maps intermediate statuses to PENDING', () => {
    for (const s of ['ACCEPTED', 'ENQUEUED', 'SUBMITTED', 'PROCESSING', 'IN_RECONCILIATION']) {
      expect(pawapay.normalizePawaPayoutStatus(s)).toBe('PENDING')
    }
  })

  it('defaults to PENDING for unknown', () => {
    expect(pawapay.normalizePawaPayoutStatus('UNKNOWN')).toBe('PENDING')
    expect(pawapay.normalizePawaPayoutStatus(null)).toBe('PENDING')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('formatAmount', () => {
  it('formats XAF as integer (no decimals)', () => {
    // PawaPay rejects "5000.00" for XAF — must send "5000"
    const result = pawapay.formatAmount(5000, 'XAF')
    expect(result).toBe('5000')
    expect(result).not.toContain('.')
  })

  it('formats XOF as integer', () => {
    expect(pawapay.formatAmount(1234.56, 'XOF')).toBe('1235')
  })

  it('rounds XAF amounts', () => {
    expect(pawapay.formatAmount(99.7, 'XAF')).toBe('100')
    expect(pawapay.formatAmount(99.2, 'XAF')).toBe('99')
  })

  it('formats non-zero-decimal currencies with 2 decimals', () => {
    expect(pawapay.formatAmount(50, 'KES')).toBe('50.00')
    expect(pawapay.formatAmount(12.5, 'GHS')).toBe('12.50')
  })

  it('handles zero-decimal currencies: GNF, RWF, BIF, MGA, UGX, KMF', () => {
    for (const cur of ['GNF', 'RWF', 'BIF', 'MGA', 'UGX', 'KMF']) {
      const result = pawapay.formatAmount(1000, cur)
      expect(result).toBe('1000')
      expect(result).not.toContain('.')
    }
  })

  it('is case-insensitive on currency code', () => {
    expect(pawapay.formatAmount(500, 'xaf')).toBe('500')
  })

  it('defaults to two-decimal format when currency is null/undefined', () => {
    expect(pawapay.formatAmount(100, null)).toBe('100.00')
    expect(pawapay.formatAmount(100, undefined)).toBe('100.00')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// verifyWebhookSignature — Content-Digest check
// ─────────────────────────────────────────────────────────────────────────────
describe('verifyWebhookSignature', () => {
  // Clear the public key so only Content-Digest is checked
  beforeEach(() => {
    process.env.PAWAPAY_WEBHOOK_PUBLIC_KEY = ''
  })

  it('accepts a valid Content-Digest', () => {
    const body = Buffer.from(JSON.stringify({ depositId: 'test-123', status: 'COMPLETED' }))
    const hash = crypto.createHash('sha256').update(body).digest('base64')
    const headers = { 'content-digest': `sha-256=:${hash}:` }

    expect(pawapay.verifyWebhookSignature(body, headers)).toBe(true)
  })

  it('rejects a tampered body (digest mismatch)', () => {
    const originalBody = Buffer.from('{"depositId":"test-123","status":"COMPLETED"}')
    const hash = crypto.createHash('sha256').update(originalBody).digest('base64')
    const headers = { 'content-digest': `sha-256=:${hash}:` }

    const tamperedBody = Buffer.from('{"depositId":"test-123","status":"COMPLETED","amount":"999999"}')
    expect(pawapay.verifyWebhookSignature(tamperedBody, headers)).toBe(false)
  })

  it('rejects missing content-digest header', () => {
    const body = Buffer.from('{}')
    expect(pawapay.verifyWebhookSignature(body, {})).toBe(false)
  })

  it('rejects a completely wrong digest value', () => {
    const body = Buffer.from('{}')
    const headers = { 'content-digest': 'sha-256=:dGhpcyBpcyBmYWtl:' }
    expect(pawapay.verifyWebhookSignature(body, headers)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// checkCallerIp
// ─────────────────────────────────────────────────────────────────────────────
describe('checkCallerIp', () => {
  it('allows any IP when PAWAPAY_ENFORCE_IP_ALLOWLIST is not true', () => {
    process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST = 'false'
    expect(pawapay.checkCallerIp('1.2.3.4').allowed).toBe(true)
  })

  it('rejects unknown IP when allowlist is enforced', () => {
    process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST = 'true'
    const result = pawapay.checkCallerIp('1.2.3.4')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('1.2.3.4')
  })

  it('accepts PawaPay egress IPs when allowlist is enforced', () => {
    process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST = 'true'
    for (const ip of pawapay.PAWAPAY_CALLBACK_IPS) {
      expect(pawapay.checkCallerIp(ip).allowed).toBe(true)
    }
  })

  it('rejects null/empty IP when allowlist is enforced', () => {
    process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST = 'true'
    expect(pawapay.checkCallerIp('').allowed).toBe(false)
    expect(pawapay.checkCallerIp(null).allowed).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveCallerIp
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveCallerIp', () => {
  it('uses X-Forwarded-For first entry when present', () => {
    expect(pawapay.resolveCallerIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, '10.0.0.1')).toBe('1.2.3.4')
  })

  it('falls back to remoteAddress when no XFF', () => {
    expect(pawapay.resolveCallerIp({}, '10.0.0.1')).toBe('10.0.0.1')
  })

  it('strips ::ffff: IPv6 prefix from remoteAddress', () => {
    expect(pawapay.resolveCallerIp({}, '::ffff:10.0.0.1')).toBe('10.0.0.1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Gateway object shape
// ─────────────────────────────────────────────────────────────────────────────
describe('gateway object', () => {
  it('has correct id and metadata', () => {
    expect(pawapay.id).toBe('pawapay')
    expect(pawapay.currencies).toContain('XAF')
    expect(pawapay.regions).toContain('CM')
  })

  it('reports enabled based on PAWAPAY_API_TOKEN', () => {
    const original = process.env.PAWAPAY_API_TOKEN
    process.env.PAWAPAY_API_TOKEN = 'test-token'
    expect(pawapay.enabled).toBe(true)
    process.env.PAWAPAY_API_TOKEN = ''
    expect(pawapay.enabled).toBe(false)
    process.env.PAWAPAY_API_TOKEN = original || ''
  })

  it('has required fields definition', () => {
    expect(pawapay.fields).toBeInstanceOf(Array)
    const phoneField = pawapay.fields.find(f => f.name === 'phone')
    expect(phoneField).toBeDefined()
    expect(phoneField.required).toBe(true)
  })

  it('exposes initialize and verify methods', () => {
    expect(typeof pawapay.initialize).toBe('function')
    expect(typeof pawapay.verify).toBe('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Webhook helper (from test helpers)
// ─────────────────────────────────────────────────────────────────────────────
describe('webhook payload + signature round-trip', () => {
  const {
    pawapayDepositWebhookPayload,
    pawapayCheckoutWebhookPayload,
    signPawapayWebhook,
  } = require('../helpers/gateways')

  it('deposit payload has required fields', () => {
    const payload = pawapayDepositWebhookPayload({ amount: 5000 })
    expect(payload.depositId).toBeDefined()
    expect(payload.status).toBe('COMPLETED')
    expect(payload.currency).toBe('XAF')
    expect(payload.payer.type).toBe('MSISDN')
  })

  it('checkout payload has required fields', () => {
    const payload = pawapayCheckoutWebhookPayload()
    expect(payload.checkoutId).toBeDefined()
    expect(payload.status).toBe('COMPLETED')
    expect(payload.amounts).toBeInstanceOf(Array)
  })

  it('signPawapayWebhook produces a valid Content-Digest that passes verification', () => {
    process.env.PAWAPAY_WEBHOOK_PUBLIC_KEY = ''
    const payload = pawapayDepositWebhookPayload({ depositId: 'round-trip-test' })
    const { body, contentDigest } = signPawapayWebhook(payload)

    const headers = { 'content-digest': contentDigest }
    expect(pawapay.verifyWebhookSignature(Buffer.from(body), headers)).toBe(true)
  })

  it('signPawapayWebhook fails verification if body is altered after signing', () => {
    process.env.PAWAPAY_WEBHOOK_PUBLIC_KEY = ''
    const payload = pawapayDepositWebhookPayload()
    const { contentDigest } = signPawapayWebhook(payload)

    const alteredBody = Buffer.from(JSON.stringify({ ...payload, status: 'FAILED' }))
    const headers = { 'content-digest': contentDigest }
    expect(pawapay.verifyWebhookSignature(alteredBody, headers)).toBe(false)
  })
})
