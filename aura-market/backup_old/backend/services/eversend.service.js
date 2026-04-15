/**
 * services/eversend.service.js
 * Eversend payment gateway — auth, collections, and webhooks.
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
 */
const getAccessToken = async () => {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  try {
    const res = await axios.get(`${EVERSEND_BASE_URL}/auth/token`, {
      headers: {
        clientId: EVERSEND_CLIENT_ID,
        clientSecret: EVERSEND_CLIENT_SECRET,
      },
    });

    const { token, expiresIn } = res.data;
    _tokenCache = {
      token: token || res.data.data?.token,
      expiresAt: now + ((expiresIn || res.data.data?.expiresIn || 86400) - 300) * 1000, 
    };

    return _tokenCache.token;
  } catch (err) {
    console.error('Eversend Auth Token Error:', err.response?.status, err.response?.data || err.message);
    throw err;
  }
};

/**
 * Build an authenticated Axios instance.
 */
const eversendClient = async () => {
  const token = await getAccessToken();
  return axios.create({
    baseURL: EVERSEND_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};

// ── Collections (receive money) ──────────────────────────────────────────────

/**
 * Initiate a payment collection (mobile money / card).
 * @param {Object} opts
 * @param {string} opts.amount        - Amount in the given currency (e.g. "10000")
 * @param {string} opts.currency      - ISO currency code (e.g. "XAF", "NGN", "UGX")
 * @param {string} opts.phone         - Customer phone number (E.164 format)
 * @param {string} opts.country       - ISO 2-letter country code (e.g. "CM", "NG")
 * @param {string} opts.firstName     - Customer first name
 * @param {string} opts.lastName      - Customer last name
 * @param {string} opts.email         - Customer email
 * @param {string} opts.redirectUrl   - URL to redirect after payment
 * @param {string} opts.transactionRef- Your unique reference
 */
const requestOTP = async (phone) => {
  const client = await eversendClient();
  const res = await client.post('/collections/otp', { phone });
  return res.data; // { success, data: { pinId, message, ... } }
};

const initiateCollection = async (opts) => {
  const client = await eversendClient();

  const payload = {
    amount: Number(opts.amount),
    currency: opts.currency,
    phone: opts.phone,
    country: opts.country,
    transactionRef: opts.transactionRef,
  };

  // Optional stringified customer schema
  if (opts.email || opts.firstName || opts.lastName) {
     payload.customer = JSON.stringify({
        email: opts.email || "",
        firstName: opts.firstName || "",
        lastName: opts.lastName || ""
     });
  }

  // Inject OTP credentials if provided (direct collection flow)
  if (opts.otp && opts.otp.pinId && opts.otp.pin) {
     payload.otp = {
        pinId: opts.otp.pinId,
        pin: opts.otp.pin
     };
  }

  console.log('[Eversend] initiateCollection payload:', JSON.stringify(payload, null, 2));
  const res = await client.post('/collections/momo', payload);
  console.log('[Eversend] initiateCollection raw response:', JSON.stringify(res.data, null, 2));
  return res.data;
};

/**
 * Get status of a specific collection transaction.
 * @param {string} transactionId - Eversend transaction ID
 */
const getCollectionStatus = async (transactionId) => {
  const client = await eversendClient();
  const res = await client.get(`/collections/${transactionId}`);
  return res.data;
};

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
  requestOTP,
  initiateCollection,
  getCollectionStatus,
  verifyWebhookSignature,
};
