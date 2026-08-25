'use strict'
/**
 * tests/helpers/gateways.js
 * Mock webhook payload builders for each payment gateway.
 *
 * Usage:
 *   const { eversendWebhookPayload, payunitWebhookPayload } = require('../helpers/gateways')
 *   const crypto = require('crypto')
 *
 *   const payload = eversendWebhookPayload({ reference: 'TX-123', amount: 5000 })
 *   const body    = JSON.stringify(payload)
 *   const sig     = crypto.createHmac('sha256', process.env.EVERSEND_WEBHOOK_SECRET)
 *                          .update(body).digest('hex')
 *
 *   await request(app)
 *     .post('/api/v1/payments/eversend/webhook')
 *     .set('Content-Type', 'application/json')
 *     .set('x-eversend-signature', sig)
 *     .send(body)
 *     .expect(200)
 */

const crypto = require('crypto')

// ── Eversend ─────────────────────────────────────────────────────────────────

/**
 * Build an Eversend payment.completed webhook payload.
 */
const eversendWebhookPayload = (overrides = {}) => ({
  // eversend.controller checks `event.type` — use the correct field name
  type: overrides.type || 'transaction.success',
  data: {
    transactionRef: overrides.reference || `EVSND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    transactionId:  overrides.transactionId || crypto.randomBytes(8).toString('hex'),
    amount:         overrides.amount || 5000,
    currency:       overrides.currency || 'XAF',
    status:         'completed',
    ...overrides.data,
  },
})

/**
 * Sign an Eversend webhook payload and return the raw body + signature header.
 * @param {object} payload   Payload object (will be JSON.stringify'd)
 * @param {string} [secret]  Defaults to EVERSEND_WEBHOOK_SECRET env var
 * @returns {{ body: string, signature: string }}
 */
const signEversendWebhook = (payload, secret) => {
  const body = JSON.stringify(payload)
  // eversend.verifyWebhookSignature uses SHA-512 (not SHA-256)
  const sig  = crypto
    .createHmac('sha512', secret || process.env.EVERSEND_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')
  return { body, signature: sig }
}

// ── PayUnit ───────────────────────────────────────────────────────────────────

/**
 * Build a PayUnit payment webhook payload.
 */
const payunitWebhookPayload = (overrides = {}) => ({
  // PayUnit sends a nested `data` object. The controller reads: event.data || event
  // so reference must be inside data as transaction_id / purchaseRef.
  data: {
    transaction_id:     overrides.reference || `PU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    transaction_status: 'SUCCESSFUL',
    amount:             overrides.amount || 5000,
    currency:           overrides.currency || 'XAF',
    ...(overrides.data || {}),
  },
})

/**
 * Sign a PayUnit webhook payload.
 */
const signPayunitWebhook = (payload, secret) => {
  const body = JSON.stringify(payload)
  const sig  = crypto
    .createHmac('sha256', secret || process.env.PAYUNIT_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')
  return { body, signature: sig }
}

// ── PawaPay ───────────────────────────────────────────────────────────────────

/**
 * Compute a PawaPay-style Content-Digest header value (SHA-256 of body).
 * Format: sha-256=:<base64>:
 */
const buildPawapayContentDigest = (bodyStr) => {
  const hash = crypto.createHash('sha256').update(Buffer.from(bodyStr)).digest('base64')
  return `sha-256=:${hash}:`
}

/**
 * Build a PawaPay deposit callback payload (status COMPLETED by default).
 */
const pawapayDepositWebhookPayload = (overrides = {}) => ({
  depositId:            overrides.depositId || crypto.randomUUID(),
  status:               overrides.status    || 'COMPLETED',
  amount:               String(overrides.amount   || '5000.00'),
  currency:             overrides.currency  || 'XAF',
  correspondent:        overrides.correspondent || 'MTN_MOMO_CMR',
  payer: { type: 'MSISDN', address: { value: overrides.phone || '237650000001' } },
  customerTimestamp:    new Date().toISOString(),
  statementDescription: 'Auradime test',
  created:              new Date().toISOString(),
  respondedByPayer:     new Date().toISOString(),
  correspondentIds:     {},
  ...(overrides._extra || {}),
})

/**
 * Build a PawaPay checkout callback payload (status COMPLETED by default).
 */
const pawapayCheckoutWebhookPayload = (overrides = {}) => ({
  checkoutId: overrides.checkoutId || crypto.randomUUID(),
  status:     overrides.status     || 'COMPLETED',
  amounts:    overrides.amounts    || [{ amount: '5000.00', currency: 'XAF' }],
  created:    new Date().toISOString(),
  ...(overrides._extra || {}),
})

/**
 * Serialise a PawaPay webhook payload and compute its Content-Digest header.
 * @param {object} payload
 * @returns {{ body: string, contentDigest: string }}
 */
const signPawapayWebhook = (payload) => {
  const body          = JSON.stringify(payload)
  const contentDigest = buildPawapayContentDigest(body)
  return { body, contentDigest }
}

// ── Flutterwave ───────────────────────────────────────────────────────────────

/**
 * Build a Flutterwave charge.completed webhook payload.
 */
const flutterwaveWebhookPayload = (overrides = {}) => ({
  event: 'charge.completed',
  data: {
    id:        overrides.txId || Math.floor(Math.random() * 1_000_000),
    tx_ref:    overrides.reference || `FLW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    amount:    overrides.amount || 5000,
    currency:  overrides.currency || 'NGN',
    status:    'successful',
    ...overrides.data,
  },
})

module.exports = {
  eversendWebhookPayload,
  signEversendWebhook,
  payunitWebhookPayload,
  signPayunitWebhook,
  flutterwaveWebhookPayload,
  pawapayDepositWebhookPayload,
  pawapayCheckoutWebhookPayload,
  signPawapayWebhook,
}
