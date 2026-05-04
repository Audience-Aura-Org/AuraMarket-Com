/**
 * services/eversendPayment.js
 * Client-side Eversend payment service.
 * Handles wallet resolution, collection initiation, polling, and recheck flows.
 * OTP is DISABLED — no OTP logic exists here.
 */

import api from '@/services/api';

// ── Wallet Resolution ─────────────────────────────────────────────────────────

/**
 * Fetch all Eversend wallets from the backend.
 * @returns {Array} wallets
 */
export const fetchEversendWallets = async () => {
  try {
    const res = await api.get('/payments/eversend/wallets');
    return res.data?.data?.wallets || [];
  } catch (err) {
    console.error('[EversendPayment] fetchWallets error:', err.response?.data || err.message);
    return [];
  }
};

/**
 * Resolve the correct wallet for a given currency from a list of wallets.
 * @param {Array}  wallets  - Array of Eversend wallet objects
 * @param {string} currency - ISO currency code (e.g. 'XAF', 'NGN')
 * @returns {object|null}
 */
export const resolveWallet = (wallets, currency) => {
  return wallets.find(w => w.currency === currency) || null;
};

/**
 * Check if a specific wallet has sufficient balance.
 * @param {string} walletId    - Eversend wallet ID
 * @param {number} amount      - Amount to check against
 * @returns {{ sufficient: boolean, balance: number }}
 */
export const checkWalletBalance = async (walletId, amount) => {
  try {
    const res = await api.get(`/payments/eversend/wallets`);
    const wallets = res.data?.data?.wallets || [];
    const wallet = wallets.find(w => w.id === walletId || w._id === walletId);
    const balance = wallet?.balance || 0;
    return { sufficient: balance >= amount, balance };
  } catch (err) {
    console.error('[EversendPayment] checkBalance error:', err.message);
    return { sufficient: false, balance: 0 };
  }
};

// ── Collection Initiation ─────────────────────────────────────────────────────

/**
 * Initiate an Eversend collection (mobile money / NGN).
 * @param {object} payload - { amount, currency, phone, country, order_ids?, redirect_url? }
 * @returns {{ success, data: { checkout_url, transaction_id, reference } }}
 */
export const initiateCollection = async (payload) => {
  const res = await api.post('/payments/eversend/initialize', payload);
  return res.data;
};

// ── Status Polling ────────────────────────────────────────────────────────────

/**
 * Poll Eversend transaction status every 5 seconds until resolved or timed out.
 *
 * @param {string}   reference   - Aura transaction reference
 * @param {object}   callbacks
 * @param {Function} callbacks.onPending   - Called each poll when still PENDING
 * @param {Function} callbacks.onSuccess   - Called on SUCCESSFUL, receives API data
 * @param {Function} callbacks.onFailed    - Called on FAILED, receives { reason }
 * @param {Function} callbacks.onTimeout   - Called when 60s expires with no resolution
 * @param {number}   [interval=5000]       - Poll interval in ms
 * @param {number}   [maxDuration=65000]   - Max wait duration in ms
 * @returns {Function} stopPolling - Call to cancel polling manually
 */
export const pollTransactionStatus = (reference, { onPending, onSuccess, onFailed, onTimeout }, interval = 5000, maxDuration = 65000) => {
  let stopped = false;
  const startTime = Date.now();

  const poll = async () => {
    if (stopped) return;

    // Client-side timeout guard
    if (Date.now() - startTime >= maxDuration) {
      if (onTimeout) onTimeout({ reference });
      return;
    }

    try {
      const res = await api.get(`/payments/eversend/verify/${reference}`);
      const { status, data, message, reason } = res.data;

      if (status === 'SUCCESSFUL') {
        if (onSuccess) onSuccess({ data, message });
        return; // Stop polling
      }

      if (status === 'FAILED') {
        if (onFailed) onFailed({ reason: reason || message });
        return; // Stop polling
      }

      if (status === 'TIMEOUT') {
        if (onTimeout) onTimeout({ reference });
        return; // Stop polling
      }

      // Still PENDING — notify and schedule next poll
      if (onPending) onPending({ message });
      if (!stopped) setTimeout(poll, interval);

    } catch (err) {
      // Network error during polling — retry unless timed out
      console.warn('[EversendPayment] Poll error, retrying:', err.message);
      if (!stopped && Date.now() - startTime < maxDuration) {
        setTimeout(poll, interval);
      } else {
        if (onTimeout) onTimeout({ reference });
      }
    }
  };

  // Start polling
  setTimeout(poll, 1000); // Initial 1s delay before first check

  return () => { stopped = true; };
};

// ── Recheck ───────────────────────────────────────────────────────────────────

/**
 * Manually re-poll a transaction for its latest status.
 * Used by the "Recheck Payment" button.
 * @param {string} reference - Aura transaction reference
 * @returns {{ status, message, reason?, data? }}
 */
export const recheckTransaction = async (reference) => {
  try {
    const res = await api.get(`/payments/eversend/recheck/${reference}`);
    return res.data;
  } catch (err) {
    const errData = err.response?.data;
    return {
      success: false,
      status: errData?.status || 'FAILED',
      message: errData?.message || 'Failed to recheck payment status.',
      reason: errData?.reason,
    };
  }
};
