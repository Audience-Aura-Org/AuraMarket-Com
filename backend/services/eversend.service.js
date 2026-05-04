/**
 * services/eversend.service.js
 * Eversend payment gateway — auth, collections, wallet linking, and webhooks.
 * OTP is DISABLED — no OTP calls are made anywhere in this service.
 * Docs: https://eversend.readme.io/reference
 */

const axios = require('axios');
const crypto = require('crypto');
const { EVERSEND_CLIENT_ID, EVERSEND_CLIENT_SECRET, EVERSEND_WEBHOOK_SECRET, EVERSEND_BASE_URL } = require('../config/env');

// ── In-memory token cache ────────────────────────────────────────────────────
let _tokenCache = { token: null, expiresAt: 0 };

/**
 * Fetch (or return cached) Eversend access token.
 * Token is valid for 24 h; we refresh 5 min early.
 * @param {boolean} force  - If true, bypass cache and force a fresh token.
 */
const getAccessToken = async (force = false) => {
  const now = Date.now();
  if (!force && _tokenCache.token && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  // Invalidate cache before requesting new token
  _tokenCache = { token: null, expiresAt: 0 };

  try {
    const res = await axios.get(`${EVERSEND_BASE_URL}/auth/token`, {
      headers: {
        clientId: EVERSEND_CLIENT_ID,
        clientSecret: EVERSEND_CLIENT_SECRET,
      },
    });

    const token = res.data?.token || res.data?.data?.token;
    const expiresIn = res.data?.expiresIn || res.data?.data?.expiresIn || 86400;

    if (!token) throw new Error('Eversend auth: no token in response');

    _tokenCache = {
      token,
      expiresAt: now + (expiresIn - 300) * 1000,
    };

    return _tokenCache.token;
  } catch (err) {
    console.error('Eversend Auth Token Error:', err.response?.status, err.response?.data || err.message);
    throw err;
  }
};

/**
 * Build an authenticated Axios instance.
 * @param {boolean} force - Force fresh token fetch.
 */
const eversendClient = async (force = false) => {
  const token = await getAccessToken(force);
  return axios.create({
    baseURL: EVERSEND_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Origin': 'https://aura-market-com.vercel.app',
      'Referer': 'https://aura-market-com.vercel.app/',
    },
  });
};

/**
 * Wraps an Eversend API call with automatic token refresh on 401.
 * Retries the request once after refreshing the token.
 * @param {Function} fn - Async function that receives an authenticated client.
 */
const withAutoRefresh = async (fn) => {
  try {
    const client = await eversendClient();
    return await fn(client);
  } catch (err) {
    if (err.response?.status === 401) {
      console.warn('[Eversend] 401 received — refreshing token and retrying...');
      const client = await eversendClient(true); // force fresh token
      return await fn(client);
    }
    throw err;
  }
};

// ── Wallet Operations ─────────────────────────────────────────────────────────

/**
 * Get all Eversend wallets for the account.
 * Used to resolve which wallet to use for a given currency.
 */
const getWallets = async () => {
  return withAutoRefresh(async (client) => {
    const res = await client.get('/wallets');
    return res.data;
  });
};

/**
 * Get a specific Eversend wallet balance by wallet ID.
 * @param {string} walletId
 */
const getWalletById = async (walletId) => {
  return withAutoRefresh(async (client) => {
    const res = await client.get(`/wallets/${walletId}`);
    return res.data;
  });
};

// ── Collections (receive money) ───────────────────────────────────────────────

/**
 * Initiate a Mobile Money payment collection.
 * NOTE: OTP is DISABLED — do not add OTP fields.
 *
 * @param {Object} opts
 * @param {number} opts.amount         - Amount in the given currency
 * @param {string} opts.currency       - ISO currency code (e.g. "XAF", "UGX", "KES", "GHS", "RWF")
 * @param {string} opts.phone          - Customer phone number (E.164 format)
 * @param {string} opts.country        - ISO 2-letter country code (e.g. "CM", "UG")
 * @param {string} opts.firstName      - Customer first name
 * @param {string} opts.lastName       - Customer last name
 * @param {string} opts.email          - Customer email
 * @param {string} opts.redirectUrl    - URL to redirect after payment (required for GH)
 * @param {string} opts.transactionRef - Your unique reference
 */
const initiateCollection = async (opts) => {
  return withAutoRefresh(async (client) => {
    const payload = {
      amount: Number(opts.amount),
      currency: opts.currency,
      phone: opts.phone,
      country: opts.country,
      transactionRef: opts.transactionRef,
    };

    // redirect_url required for Ghana collections
    if (opts.redirectUrl) {
      payload.redirect_url = opts.redirectUrl;
    }

    // Customer object as JSON string per Eversend docs
    if (opts.email || opts.firstName || opts.lastName) {
      payload.customer = JSON.stringify({
        email: opts.email || '',
        firstName: opts.firstName || '',
        lastName: opts.lastName || '',
      });
    }

    console.log('[Eversend] initiateCollection (momo) payload:', JSON.stringify(payload, null, 2));
    const res = await client.post('/collections/momo', payload);
    return res.data;
  });
};

/**
 * Initiate a Nigerian NGN collection.
 * Uses a separate endpoint per Eversend docs.
 *
 * @param {Object} opts - Same shape as initiateCollection
 */
const initiateNGNCollection = async (opts) => {
  return withAutoRefresh(async (client) => {
    const payload = {
      amount: Number(opts.amount),
      currency: 'NGN',
      phone: opts.phone,
      country: 'NG',
      transactionRef: opts.transactionRef,
    };

    if (opts.redirectUrl) payload.redirect_url = opts.redirectUrl;

    if (opts.email || opts.firstName || opts.lastName) {
      payload.customer = JSON.stringify({
        email: opts.email || '',
        firstName: opts.firstName || '',
        lastName: opts.lastName || '',
      });
    }

    console.log('[Eversend] initiateNGNCollection payload:', JSON.stringify(payload, null, 2));
    const res = await client.post('/collections/ngn', payload);
    return res.data;
  });
};

/**
 * Get transaction status by transaction ID.
 * Uses GET /transactions/:transactionId per Eversend API docs.
 * Returns statuses: PENDING | SUCCESSFUL | FAILED
 * @param {string} transactionId - Eversend transaction ID
 */
const getTransactionStatus = async (transactionId) => {
  return withAutoRefresh(async (client) => {
    const res = await client.get(`/transactions/${transactionId}`);
    return res.data;
  });
};

/**
 * Legacy alias — kept for any code that still calls getCollectionStatus.
 * Internally uses getTransactionStatus.
 * @deprecated Use getTransactionStatus instead.
 */
const getCollectionStatus = getTransactionStatus;

// ── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify an incoming Eversend webhook by its HMAC-SHA512 signature.
 * @param {Buffer|string} rawBody   - Raw request body (use express.raw() middleware)
 * @param {string}        signature - Value of the x-eversend-signature header
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const hash = crypto
    .createHmac('sha512', EVERSEND_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
};

module.exports = {
  getAccessToken,
  withAutoRefresh,
  // Wallet
  getWallets,
  getWalletById,
  // Collections
  initiateCollection,
  initiateNGNCollection,
  // Status
  getTransactionStatus,
  getCollectionStatus, // legacy alias
  // Webhook
  verifyWebhookSignature,
};
