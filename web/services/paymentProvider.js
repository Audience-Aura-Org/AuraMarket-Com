/**
 * services/paymentProvider.js
 * Client-side Unified Payment Service.
 * Interfaces with Aura Backend for gateway-specific operations.
 * NO direct calls to external payment APIs (Eversend, etc.) are made here.
 */

import api from '@/services/api';

// ── Wallet / Gateway Resolution ──────────────────────────────────────────────

/**
 * Fetch supported gateway configurations (e.g. wallets, available countries).
 * @param {string} gateway - 'eversend' or other
 */
export const fetchGatewayConfig = async (gateway = 'eversend') => {
  try {
    const res = await api.get(`/payments/${gateway}/wallets`);
    return res.data?.data || {};
  } catch (err) {
    console.error(`[PaymentProvider] fetchConfig error (${gateway}):`, err.message);
    return {};
  }
};

// ── Collection Initiation ─────────────────────────────────────────────────────

/**
 * Initiate a payment collection through the backend.
 * @param {string} gateway - 'eversend', 'payunit', etc.
 * @param {object} payload - Gateway-specific details
 */
export const initiateCollection = async (gateway, payload) => {
  const res = await api.post(`/payments/${gateway}/initialize`, payload);
  return res.data;
};

// ── Status Polling ────────────────────────────────────────────────────────────

/**
 * Unified polling for transaction status.
 * @param {string} gateway   - Gateway used
 * @param {string} reference - Transaction reference
 */
export const pollTransactionStatus = (gateway, reference, { onPending, onSuccess, onFailed, onTimeout }, interval = 5000, maxDuration = 300000) => {
  let stopped = false;
  const startTime = Date.now();

  const poll = async () => {
    if (stopped) return;

    if (Date.now() - startTime >= maxDuration) {
      if (onTimeout) onTimeout({ reference });
      return;
    }

    try {
      const res = await api.get(`/payments/${gateway}/verify/${reference}`);
      const { status, data, message, reason } = res.data;

      if (status === 'SUCCESSFUL') {
        if (onSuccess) onSuccess({ data, message });
        return;
      }

      if (status === 'FAILED') {
        if (onFailed) onFailed({ reason: reason || message });
        return;
      }

      if (status === 'TIMEOUT') {
        if (onTimeout) onTimeout({ reference });
        return;
      }

      if (onPending) onPending({ message });
      if (!stopped) setTimeout(poll, interval);

    } catch (err) {
      console.warn(`[PaymentProvider] Poll error (${gateway}):`, err.message);
      if (!stopped && Date.now() - startTime < maxDuration) {
        setTimeout(poll, interval);
      } else {
        if (onTimeout) onTimeout({ reference });
      }
    }
  };

  setTimeout(poll, 1000);
  return () => { stopped = true; };
};

// ── Recheck ───────────────────────────────────────────────────────────────────

/**
 * Manually re-poll a transaction for its latest status.
 */
export const recheckTransaction = async (gateway, reference) => {
  try {
    const res = await api.get(`/payments/${gateway}/recheck/${reference}`);
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

