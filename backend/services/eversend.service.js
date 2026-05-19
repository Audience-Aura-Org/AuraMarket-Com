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
      const errMsg = err.response?.data?.message || '';
      // 'Invalid request origin' = IP whitelist rejection — retrying won't help
      if (errMsg.toLowerCase().includes('origin') || errMsg.toLowerCase().includes('whitelist')) {
        console.error('[Eversend] IP whitelist rejection — this server is not whitelisted by Eversend. Only the production server (13.51.198.119) can call Eversend APIs.');
        throw err; // don't retry
      }
      console.warn('[Eversend] 401 received — refreshing token and retrying...');
      const client = await eversendClient(true);
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

// ── Payout API ───────────────────────────────────────────────────────────────

/**
 * STEP 1: Get a payout quotation token.
 * Must be called before any payout execution.
 * @param {number} amount
 * @param {string} sourceCurrency      - e.g. 'XAF' (Aura wallet currency)
 * @param {string} destinationCurrency - e.g. 'XAF' (Target currency)
 * @param {string} destinationCountry  - e.g. 'CM' (ISO 2-letter)
 * @param {string} type                - 'momo' | 'bank' | 'eversend'
 * @returns {{ token, fees, exchangeRate, ... }}
 */
const getPayoutQuotation = async (amount, sourceCurrency, destinationCurrency, destinationCountry, type) => {
  return withAutoRefresh(async (client) => {
    // For Eversend Tag transfers, the endpoint is different
    const endpoint = type === 'eversend' ? '/payouts/quotation/eversend' : '/payouts/quotation';
    
    const payload = {
      amount: Number(amount),
      sourceWallet: sourceCurrency,
      destinationCurrency,
      amountType: 'SOURCE',
      type,
    };

    if (type !== 'eversend') {
      payload.destinationCountry = destinationCountry;
    }

    const res = await client.post(endpoint, payload);
    return res.data;
  });
};

/**
 * STEP 2a: Execute a Mobile Money payout.
 * @param {string} token          - Quotation token from getPayoutQuotation
 * @param {string} phoneNumber
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} country        - ISO 2-letter code e.g. 'UG'
 * @param {string} transactionRef - Your internal withdrawal request ID
 */
const executeMomoPayout = async (token, phoneNumber, firstName, lastName, country, transactionRef) => {
  return withAutoRefresh(async (client) => {
    const res = await client.post('/payouts', {
      token,
      phoneNumber,
      firstName,
      lastName,
      country,
      transactionRef,
    });
    return res.data;
  });
};

/**
 * STEP 2b: Execute a Bank payout.
 */
const executeBankPayout = async (token, bankCode, accountNumber, firstName, lastName, country, transactionRef) => {
  return withAutoRefresh(async (client) => {
    const res = await client.post('/payouts/bank', {
      token,
      bankCode,
      accountNumber,
      firstName,
      lastName,
      country,
      transactionRef,
    });
    return res.data;
  });
};

/**
 * STEP 2c: Execute an Eversend wallet-to-wallet payout.
 */
const executeEversendPayout = async (token, eversendTag, transactionRef) => {
  return withAutoRefresh(async (client) => {
    const res = await client.post('/payouts/eversend', {
      token,
      eversendTag,
      transactionRef,
    });
    return res.data;
  });
};

/**
 * Execute a payout to a saved beneficiary.
 * @param {string} token          - Quotation token
 * @param {string} beneficiaryId  - Saved beneficiary ID
 * @param {string} transactionRef - Your internal reference
 */
const executeBeneficiaryPayout = async (token, beneficiaryId, transactionRef) => {
  return withAutoRefresh(async (client) => {
    const res = await client.post('/payouts/beneficiary', {
      token,
      beneficiaryId,
      transactionRef,
    });
    return res.data;
  });
};

const verifyWebhookSignature = (payload, signature) => {
  if (!signature || !EVERSEND_WEBHOOK_SECRET) return false;
  try {
    const hmac = crypto.createHmac('sha512', EVERSEND_WEBHOOK_SECRET);
    
    // Convert Buffer to string if necessary (Express raw body parser returns Buffer)
    let data = payload;
    if (Buffer.isBuffer(payload)) {
      data = payload.toString('utf8');
    } else if (typeof payload !== 'string') {
      data = JSON.stringify(payload);
    }
    
    const digest = hmac.update(data).digest('hex');
    return digest === signature;
  } catch (err) {
    console.error('Webhook signature verification error:', err.message);
    return false;
  }
};

/**
 * Get all saved beneficiaries.
 */
const getBeneficiaries = async () => {
  return withAutoRefresh(async (client) => {
    const res = await client.get('/beneficiaries');
    return res.data;
  });
};

/**
 * Create a new beneficiary.
 * @param {Object} data - { firstName, lastName, country, phoneNumber, bankCode, accountNumber, type }
 */
const createBeneficiary = async (data) => {
  return withAutoRefresh(async (client) => {
    const res = await client.post('/beneficiaries', data);
    return res.data;
  });
};

/**
 * Delete a beneficiary.
 * @param {string} beneficiaryId
 */
const deleteBeneficiary = async (beneficiaryId) => {
  return withAutoRefresh(async (client) => {
    const res = await client.delete(`/beneficiaries/${beneficiaryId}`);
    return res.data;
  });
};

/**
 * Fetch transaction history.
 * @param {Object} filters - { type, status, currency, page, limit, from, to }
 */
const getTransactions = async (filters = {}) => {
  return withAutoRefresh(async (client) => {
    const res = await client.get('/transactions', { params: filters });
    return res.data;
  });
};

module.exports = {
  getAccessToken,
  withAutoRefresh,
  // Wallets
  getWallets,
  getWalletById,
  // Collections
  initiateCollection,
  initiateNGNCollection,
  getTransactionStatus,
  getCollectionStatus, // Legacy alias
  // Payouts
  getPayoutQuotation,
  executeMomoPayout,
  executeBankPayout,
  executeEversendPayout,
  executeBeneficiaryPayout,
  // Webhook
  verifyWebhookSignature,
  // Beneficiaries
  getBeneficiaries,
  createBeneficiary,
  deleteBeneficiary,
  // History
  getTransactions,
};

