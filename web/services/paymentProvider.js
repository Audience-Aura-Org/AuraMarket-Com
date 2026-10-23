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

const normalizedCameroonPhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '').replace(/^00/, '');
  const withCountryCode = digits.startsWith('237') ? digits.slice(3) : digits.replace(/^0/, '');
  return withCountryCode.slice(0, 9);
};

// Cameroon Orange ranges: 620–629, 655–659 and 690–699. PawaPay's current
// live configuration is MTN-only, so Orange must be routed straight to PayUnit.
export const resolveCameroonMobileMoneyGateway = (phone = '') => {
  const local = normalizedCameroonPhone(phone);
  const prefix3 = Number(local.slice(0, 3));
  const isOrange = (prefix3 >= 620 && prefix3 <= 629)
    || (prefix3 >= 655 && prefix3 <= 659)
    || (prefix3 >= 690 && prefix3 <= 699);

  return {
    gateway: isOrange ? 'payunit' : 'pawapay',
    provider: isOrange ? 'CM_ORANGE' : 'CM_MTNMOMO',
    network: isOrange ? 'orange' : 'mtn',
  };
};

const isSafePreChargeFallbackError = (error) => {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || error?.message || '').toLowerCase();
  return status === 404 || status === 501 || (status === 503 && message.includes('unavailable'));
};

/**
 * Route Cameroon mobile-money requests to the provider configured for that
 * network. Fallback chain:
 *   PawaPay (MTN) → PayUnit → Eversend
 *   PayUnit (Orange) → Eversend
 *
 * A fallback is intentionally limited to a definite pre-charge route
 * or service failure; retrying after a network timeout could create two charges.
 */
export const initiateSmartCameroonCollection = async (payload) => {
  const route = resolveCameroonMobileMoneyGateway(payload.phone);
  const requestPayload = { ...payload, provider: route.provider };

  try {
    const result = await initiateCollection(route.gateway, requestPayload);
    return { ...result, gateway: route.gateway, routedNetwork: route.network };
  } catch (error) {
    if (!isSafePreChargeFallbackError(error)) throw error;

    // PawaPay failed → try PayUnit → then Eversend
    if (route.gateway === 'pawapay') {
      try {
        const fallbackPayload = { ...payload, provider: 'CM_MTNMOMO' };
        const result = await initiateCollection('payunit', fallbackPayload);
        return { ...result, gateway: 'payunit', routedNetwork: 'mtn', fallbackUsed: true };
      } catch (payunitError) {
        if (!isSafePreChargeFallbackError(payunitError)) throw payunitError;
        // PayUnit also down → last resort: Eversend
        const result = await initiateCollection('eversend', payload);
        return { ...result, gateway: 'eversend', routedNetwork: route.network, fallbackUsed: true, fallbackLevel: 2 };
      }
    }

    // PayUnit (Orange) failed → try Eversend
    if (route.gateway === 'payunit') {
      const result = await initiateCollection('eversend', payload);
      return { ...result, gateway: 'eversend', routedNetwork: route.network, fallbackUsed: true };
    }

    throw error;
  }
};

// ── Status Polling ────────────────────────────────────────────────────────────

/**
 * Unified polling for transaction status.
 * @param {string} gateway   - Gateway used
 * @param {string} reference - Transaction reference
 */
export const pollTransactionStatus = (gateway, reference, { onPending, onSuccess, onFailed, onTimeout }, interval = 5000, maxDuration = 300000) => {
  let stopped = false;
  let timer;
  const startTime = Date.now();
  const schedule = (delay) => { timer = setTimeout(poll, delay); };
  const finish = (callback, payload) => { if (stopped) return; stopped = true; clearTimeout(timer); callback?.(payload); };
  const poll = async () => {
    if (stopped) return;
    if (Date.now() - startTime >= maxDuration) { finish(onTimeout, { reference }); return; }
    try {
      const res = await api.get('/payments/' + encodeURIComponent(gateway) + '/verify/' + encodeURIComponent(reference), { skipClientCache: true, __skipRetry: true });
      if (stopped) return;
      const { status, data, message, reason } = res.data;
      if (status === 'SUCCESSFUL') { finish(onSuccess, { data, message }); return; }
      if (status === 'FAILED') { finish(onFailed, { reason: reason || message }); return; }
      if (status === 'TIMEOUT') { finish(onTimeout, { reference }); return; }
      onPending?.({ message });
    } catch (err) {
      if (stopped) return;
      console.warn('[PaymentProvider] Payment status could not be checked:', err.message);
    }
    if (!stopped) schedule(Math.min(interval, Math.max(0, maxDuration - (Date.now() - startTime))));
  };
  schedule(1000);
  return () => { stopped = true; clearTimeout(timer); };
};

// ── Recheck ───────────────────────────────────────────────────────────────────

/**
 * Ask the server for a transaction's latest status.
 * Resolves to { status: 'SUCCESSFUL' | 'FAILED' | 'PENDING', message, reason, data }.
 * Never throws. The payment's outcome is read from the body even on an HTTP
 * error (older servers answered a declined payment with 400), and a request
 * that got no answer is PENDING (with unreachable: true) — never FAILED, which
 * would tell the user a payment failed when we simply could not ask.
 */
const readRecheck = async (url) => {
  try {
    const res = await api.get(url, { skipClientCache: true });
    return { ...res.data, status: res.data?.status || 'PENDING' };
  } catch (err) {
    const body = err.response?.data;
    if (body?.status === 'SUCCESSFUL' || body?.status === 'FAILED') return body;
    return {
      success: false,
      status: 'PENDING',
      unreachable: !err.response,
      message: body?.message || (err.response
        ? 'Could not check the status right now. Please try again shortly.'
        : 'Could not reach the server. Check your connection and try again.'),
    };
  }
};

export const recheckTransaction = (gateway, reference) =>
  readRecheck(`/payments/${gateway}/recheck/${encodeURIComponent(reference)}`);

/** Same contract for a withdrawal payout (user-facing endpoint). */
export const recheckWithdrawal = (withdrawalId) =>
  readRecheck(`/withdrawals/mine/${encodeURIComponent(withdrawalId)}/recheck`);

