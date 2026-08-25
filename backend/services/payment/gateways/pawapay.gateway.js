/**
 * services/payment/gateways/pawapay.gateway.js
 * Auradime — PawaPay Mobile Money Gateway
 *
 * Supports XAF deposits via MTN MoMo and Orange Money (Cameroon).
 * API docs: https://docs.pawapay.io/
 *
 * Env vars required:
 *   PAWAPAY_API_TOKEN    — Bearer token from PawaPay dashboard
 *   PAWAPAY_SANDBOX_MODE — 'true' for sandbox, anything else for production
 */

const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../../../models/Transaction.model');

// ---------------------------------------------------------------------------
// API Client Helpers
// ---------------------------------------------------------------------------

const getBaseUrl = () =>
  process.env.PAWAPAY_SANDBOX_MODE === 'true'
    ? 'https://api.sandbox.pawapay.io'
    : 'https://api.pawapay.io';

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
  'Content-Type': 'application/json',
});

/**
 * Strip non-digits and normalize to MSISDN without leading '+'.
 * PawaPay expects the raw MSISDN, e.g. "237678901234".
 */
const normalizePhone = (phone) => {
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith('237')) {
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = `237${digits}`;
  }
  return digits;
};

/**
 * Auto-detect Cameroon mobile operator from phone prefix.
 * MTN: 65x, 67x, 68x (650-689)
 * Orange: 69x, 62x (620-629, 690-699)
 */
const detectProvider = (phone) => {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length >= 9 ? digits.slice(-9) : digits;
  const prefix = parseInt(local.substring(0, 2), 10);
  if ([65, 67, 68].includes(prefix)) return 'MTN_MOMO_CMR';
  if ([69, 62].includes(prefix)) return 'ORANGE_MONEY_CMR';
  // Fallback: caller should surface this as a prompt to the user
  return 'MTN_MOMO_CMR';
};

/**
 * Map PawaPay status strings to our internal status tokens.
 */
const normalizeStatus = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':         return 'SUCCESSFUL';
    case 'FAILED':            return 'FAILED';
    case 'ACCEPTED':          return 'PENDING';
    case 'DUPLICATE_IGNORED': return 'DUPLICATE';
    default:                  return 'PENDING';
  }
};

// ---------------------------------------------------------------------------
// Amount Formatting
// ---------------------------------------------------------------------------

/**
 * XAF, XOF, and several other African currencies are "zero-decimal" in ISO 4217 —
 * they have no subunit. PawaPay rejects amounts that include a decimal point for
 * these currencies (e.g. "500.00" → HTTP 400). For all other currencies we keep
 * the standard two-decimal representation.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'XAF', 'XOF', // CFA franc (Central / West Africa)
  'GNF', 'RWF', 'BIF', 'MGA', 'UGX', 'KMF', // other zero-decimal African currencies
]);

const formatAmount = (amount, currency) =>
  ZERO_DECIMAL_CURRENCIES.has((currency || '').toUpperCase())
    ? String(Math.round(Number(amount)))
    : Number(amount).toFixed(2);

// ---------------------------------------------------------------------------
// PawaPay API Calls
// ---------------------------------------------------------------------------

/**
 * Initiate a deposit (PUSH to subscriber's phone).
 */
const createDeposit = async ({ depositId, amount, currency, correspondent, phone, description, returnUrl }) => {
  const payload = {
    depositId,
    amount: formatAmount(amount, currency),
    currency,
    correspondent,
    payer: {
      type: 'MSISDN',
      address: { value: normalizePhone(phone) },
    },
    customerTimestamp: new Date().toISOString(),
    // PawaPay enforces 4–22 char statement description
    statementDescription: (description || 'Auradime payment').slice(0, 22).padEnd(4, ' '),
    ...(returnUrl ? { returnUrl } : {}),
  };

  const { data } = await axios.post(
    `${getBaseUrl()}/v2/deposits`,
    payload,
    { headers: getHeaders(), timeout: 30000 }
  );
  return data;
};

/**
 * Fetch the latest status of a deposit by its depositId.
 */
const getDepositStatus = async (depositId) => {
  const { data } = await axios.get(
    `${getBaseUrl()}/v2/deposits/${depositId}`,
    { headers: getHeaders(), timeout: 15000 }
  );
  return Array.isArray(data) ? data[0] : data;
};

/**
 * Create a PawaPay hosted checkout (redirect flow).
 * User is sent to PawaPay's checkout page to enter their own phone number.
 * @param {{ checkoutId, amounts, returnUrl, description }} opts
 * amounts = [{ amount, currency }]
 */
const createCheckout = async ({ checkoutId, amounts, returnUrl, description }) => {
  const { data } = await axios.post(
    `${getBaseUrl()}/v2/checkouts`,
    {
      checkoutId,
      returnUrl,
      amounts: amounts.map((a) => ({
        amount: formatAmount(a.amount, a.currency),
        currency: a.currency,
      })),
      statementDescription: (description || 'Auradime payment').slice(0, 22).padEnd(4, ' '),
    },
    { headers: getHeaders(), timeout: 30000 }
  );
  return data;
};

/**
 * Fetch the latest status of a checkout by its checkoutId.
 */
const getCheckoutStatus = async (checkoutId) => {
  const { data } = await axios.get(
    `${getBaseUrl()}/v2/checkouts/${checkoutId}`,
    { headers: getHeaders(), timeout: 15000 }
  );
  return Array.isArray(data) ? data[0] : data;
};

/**
 * Initiate a payout (PUSH from merchant wallet to subscriber's phone).
 * Uses PawaPay v2 disbursement API — different body shape from deposits:
 *   recipient.type = 'MMO', accountDetails = { phoneNumber, provider }
 * @param {{ payoutId, amount, currency, correspondent, phone, description, clientRef }} opts
 */
const createPayout = async ({ payoutId, amount, currency, correspondent, phone, description, clientRef }) => {
  const payload = {
    payoutId,
    amount: formatAmount(amount, currency),
    currency,
    recipient: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: normalizePhone(phone),  // digits-only, country-code included e.g. 237XXXXXXXXX
        provider:    correspondent,           // e.g. MTN_MOMO_CMR or ORANGE_MONEY_CMR
      },
    },
    // customerMessage: 4–22 chars, alphanumeric + spaces only (PawaPay constraint)
    customerMessage: (description || 'Auradime withdrawal').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 22).padEnd(4, ' '),
    ...(clientRef ? { clientReferenceId: clientRef } : {}),
  };

  const { data } = await axios.post(
    `${getBaseUrl()}/v2/payouts`,
    payload,
    { headers: getHeaders(), timeout: 30000 }
  );
  return data;
};

/**
 * Fetch the latest status of a payout by its payoutId.
 * Response: { status: 'FOUND', data: { payoutId, status, ... } }
 */
const getPayoutStatus = async (payoutId) => {
  const { data } = await axios.get(
    `${getBaseUrl()}/v2/payouts/${payoutId}`,
    { headers: getHeaders(), timeout: 15000 }
  );
  // PawaPay wraps payout status in { status: 'FOUND', data: {...} }
  return data?.data || data;
};

/**
 * Map PawaPay payout status strings to our internal tokens.
 * Payout has more intermediate statuses than deposit.
 */
const normalizePawaPayoutStatus = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':          return 'SUCCESSFUL';
    case 'FAILED':             return 'FAILED';
    case 'ACCEPTED':
    case 'ENQUEUED':
    case 'SUBMITTED':
    case 'PROCESSING':
    case 'IN_RECONCILIATION':
      return 'PENDING';
    default:                   return 'PENDING';
  }
};

/**
 * Request a refund for a completed deposit.
 */
const createRefund = async ({ refundId, depositId, amount, currency }) => {
  const { data } = await axios.post(
    `${getBaseUrl()}/v2/refunds`,
    {
      refundId,
      depositId,
      amount: formatAmount(amount, currency),
      currency,
    },
    { headers: getHeaders(), timeout: 30000 }
  );
  return data;
};

// ---------------------------------------------------------------------------
// Webhook Signature Verification (RFC-9421) + IP Allowlist
// ---------------------------------------------------------------------------

/**
 * PawaPay's known callback IP ranges.
 * Source: https://docs.pawapay.io/technical/callbacks
 *
 * Production and sandbox share the same egress IPs.
 * Set PAWAPAY_ENFORCE_IP_ALLOWLIST=true in .env to activate.
 * If disabled (default), only Content-Digest / RSA is checked.
 */
const PAWAPAY_CALLBACK_IPS = new Set([
  '18.192.208.15',
  '18.195.113.136',
  '3.72.212.107',
  '3.65.153.31',
  // Sandbox additional IPs (same pool as production per PawaPay docs)
]);

/**
 * Extract the real caller IP from the request, honouring X-Forwarded-For
 * set by Nginx (trust proxy must be enabled on the Express app).
 * @param {Object} headers
 * @param {string} remoteAddress  — req.socket.remoteAddress
 */
const resolveCallerIp = (headers, remoteAddress = '') => {
  const xff = headers['x-forwarded-for'];
  if (xff) {
    // X-Forwarded-For can be a comma-separated list; first entry is the client
    return xff.split(',')[0].trim();
  }
  return remoteAddress.replace(/^::ffff:/, '');
};

/**
 * Check whether req.ip (after trust-proxy) is one of PawaPay's egress IPs.
 * Only enforced when PAWAPAY_ENFORCE_IP_ALLOWLIST=true.
 * @param {string} callerIp
 * @returns {{ allowed: boolean, reason?: string }}
 */
const checkCallerIp = (callerIp) => {
  if (process.env.PAWAPAY_ENFORCE_IP_ALLOWLIST !== 'true') {
    return { allowed: true }; // allowlist not enforced — skip
  }
  if (!callerIp || !PAWAPAY_CALLBACK_IPS.has(callerIp)) {
    return { allowed: false, reason: `IP ${callerIp} not in PawaPay allowlist` };
  }
  return { allowed: true };
};

/**
 * Verify the Content-Digest header (SHA-256 of body).
 * This is the minimum integrity check. Full RSA-PSS signature verification
 * can be enabled by setting PAWAPAY_WEBHOOK_PUBLIC_KEY to PawaPay's RSA public
 * key in PEM format (available from the PawaPay dashboard / JWKS endpoint).
 *
 * @param {Buffer} rawBody
 * @param {Object} headers  — lowercased header map
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, headers) => {
  // 1. Content-Digest check (mandatory — confirms body wasn't tampered with)
  const contentDigest = headers['content-digest'];
  if (!contentDigest) {
    console.warn('[PawaPay] Webhook missing content-digest header');
    return false;
  }
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('base64');
  const expectedDigest = `sha-256=:${bodyHash}:`;
  if (contentDigest !== expectedDigest) {
    console.warn('[PawaPay] Webhook Content-Digest mismatch');
    return false;
  }

  // 2. ECDSA P-256 / SHA-256 signature verification (RFC-9421, algorithm: ecdsa-p256-sha256)
  // PawaPay's public key type is HTTP_EC_P256_KEY — fetch from GET /v2/public-key/http
  const pubKey = process.env.PAWAPAY_WEBHOOK_PUBLIC_KEY;
  if (!pubKey) {
    // No public key configured — accept after Content-Digest check
    return true;
  }

  const signatureInput = headers['signature-input'];
  const signatureHeader = headers['signature'];

  if (!signatureInput || !signatureHeader) {
    console.warn('[PawaPay] Missing signature/signature-input headers for full verification');
    return false;
  }

  try {
    // Parse sig1 params and covered components from Signature-Input
    const sig1Match = signatureInput.match(/sig1=(\([^)]*\)[^,]*)/);
    if (!sig1Match) return false;
    const sigParams = sig1Match[1];

    const componentsMatch = sigParams.match(/\(([^)]*)\)/);
    const componentIds = componentsMatch
      ? componentsMatch[1].replace(/"/g, '').trim().split(/\s+/).filter(Boolean)
      : [];

    // Build signature base string (RFC-9421 §2.5)
    const lines = [];
    for (const comp of componentIds) {
      if (comp === 'content-digest') {
        lines.push(`"content-digest": ${contentDigest}`);
      }
    }
    lines.push(`@signature-params: sig1=${sigParams}`);
    const signatureBase = lines.join('\n');

    // Extract base64 signature bytes
    const sigMatch = signatureHeader.match(/sig1=:([^:]+):/);
    if (!sigMatch) return false;
    const signatureBytes = Buffer.from(sigMatch[1], 'base64');

    // ECDSA P-256 with SHA-256; RFC-9421 §3.3.5 specifies raw r||s encoding (IEEE P1363)
    return crypto.verify(
      'sha256',
      Buffer.from(signatureBase),
      { key: pubKey, dsaEncoding: 'ieee-p1363' },
      signatureBytes
    );
  } catch (err) {
    console.error('[PawaPay] Signature verification error:', err.message);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Gateway Object (GatewayInterface)
// ---------------------------------------------------------------------------

const pawapayGateway = {
  id: 'pawapay',
  label: 'PawaPay Mobile Money',
  description: 'Pay via MTN MoMo or Orange Money (Cameroon).',
  icon: '📱',
  currencies: ['XAF'],
  regions: ['CM'],
  // Disabled at startup if no API token is present
  get enabled() {
    return !!process.env.PAWAPAY_API_TOKEN;
  },
  fields: [
    {
      name: 'phone',
      label: 'Mobile Money Number',
      type: 'tel',
      placeholder: '+237 6XX XXX XXX',
      required: true,
    },
    {
      name: 'provider',
      label: 'Mobile Operator',
      type: 'select',
      required: false,
      options: [
        { value: 'MTN_MOMO_CMR', label: 'MTN MoMo' },
        { value: 'ORANGE_MONEY_CMR', label: 'Orange Money' },
      ],
    },
  ],

  // Expose internals so controller can use them
  normalizePhone,
  detectProvider,
  normalizeStatus,
  normalizePawaPayoutStatus,
  createDeposit,
  getDepositStatus,
  createCheckout,
  getCheckoutStatus,
  createPayout,
  getPayoutStatus,
  createRefund,
  verifyWebhookSignature,
  checkCallerIp,
  resolveCallerIp,
  PAWAPAY_CALLBACK_IPS,

  /**
   * Start a PawaPay deposit (PUSH to subscriber's phone).
   * @param {Object} ctx - { user, amount, currency, orderIds, fields, req }
   * @returns {{ checkout_url, reference, transaction_id }}
   */
  async initialize({ user, amount, currency = 'XAF', orderIds = [], fields = {}, req }) {
    const { phone, provider } = fields;
    if (!phone) throw new Error('Phone number is required for PawaPay payment.');

    // Idempotency guard: if there is already a pending PawaPay transaction for
    // these exact orders, return it rather than creating a duplicate.
    if (orderIds.length > 0) {
      const existing = await Transaction.findOne({
        user_id:   user._id,
        gateway:   'pawapay',
        status:    'pending',
        order_ids: { $all: orderIds, $size: orderIds.length },
      }).lean();
      if (existing) {
        const webUrl = process.env.WEB_CLIENT_URL || 'https://auradime.com';
        const returnUrl = `${webUrl}/wallet/verify?gateway=pawapay&ref=${existing.reference}`;
        return {
          checkout_url:   returnUrl,
          reference:      existing.reference,
          transaction_id: existing.gateway_transaction_id,
        };
      }
    }

    const correspondent = provider || detectProvider(phone);
    const depositId = crypto.randomUUID();
    const transactionRef = `AURA-PP-${depositId}`;
    const webUrl = process.env.WEB_CLIENT_URL || 'https://auradime.com';
    const returnUrl = `${webUrl}/wallet/verify?gateway=pawapay&ref=${transactionRef}`;

    // Sandbox mode: create a pending transaction without hitting the real API
    if (process.env.PAWAPAY_SANDBOX_MODE === 'true') {
      await Transaction.create({
        user_id: user._id,
        type: orderIds.length > 0 ? 'payment' : 'deposit',
        amount: Number(amount),
        currency,
        reference: transactionRef,
        gateway_transaction_id: depositId,
        status: 'pending',
        gateway: 'pawapay',
        order_ids: orderIds,
        description: `[SANDBOX] PawaPay deposit via ${correspondent}`,
        metadata: { is_sandbox: true, depositId, correspondent, phone: normalizePhone(phone) },
      });
      return {
        checkout_url: `${returnUrl}&sandbox=true`,
        reference: transactionRef,
        transaction_id: depositId,
      };
    }

    // Live: submit deposit to PawaPay
    const result = await createDeposit({
      depositId,
      amount,
      currency,
      correspondent,
      phone,
      description: orderIds.length > 0 ? 'Auradime order' : 'Auradime deposit',
      returnUrl,
    });

    const status = (result?.status || '').toUpperCase();
    if (status === 'REJECTED' || status === 'FAILED') {
      throw new Error(
        result?.rejectionReason?.rejectionMessage || 'PawaPay deposit was rejected by the operator.'
      );
    }

    await Transaction.create({
      user_id: user._id,
      type: orderIds.length > 0 ? 'payment' : 'deposit',
      amount: Number(amount),
      currency,
      reference: transactionRef,
      gateway_transaction_id: depositId,
      status: 'pending',
      gateway: 'pawapay',
      order_ids: orderIds,
      description:
        orderIds.length > 0
          ? `Checkout for ${orderIds.length} order(s) via PawaPay (${currency})`
          : `Wallet deposit via PawaPay (${currency})`,
      metadata: { depositId, correspondent, phone: normalizePhone(phone) },
    });

    return { checkout_url: returnUrl, reference: transactionRef, transaction_id: depositId };
  },

  /**
   * Verify a PawaPay deposit by our internal reference.
   * @param {string} reference
   * @returns {{ status: 'SUCCESSFUL'|'FAILED'|'PENDING', amount?, reason? }}
   */
  async verify(reference) {
    const transaction = await Transaction.findOne({ reference, gateway: 'pawapay' });
    if (!transaction) return { status: 'PENDING' };
    if (transaction.status === 'completed') return { status: 'SUCCESSFUL', amount: transaction.amount };
    if (transaction.status === 'failed') return { status: 'FAILED', reason: transaction.gateway_response?.message };

    const depositId = transaction.gateway_transaction_id || transaction.metadata?.depositId;
    if (!depositId) return { status: 'PENDING' };

    // Sandbox: auto-succeed
    if (transaction.metadata?.is_sandbox) return { status: 'SUCCESSFUL', amount: transaction.amount };

    const result = await getDepositStatus(depositId);
    const norm = normalizeStatus(result?.status);
    if (norm === 'SUCCESSFUL') return { status: 'SUCCESSFUL', amount: transaction.amount };
    if (norm === 'FAILED') {
      return { status: 'FAILED', reason: result?.rejectionReason?.rejectionMessage || 'Declined by operator.' };
    }
    return { status: 'PENDING' };
  },
};

module.exports = pawapayGateway;
