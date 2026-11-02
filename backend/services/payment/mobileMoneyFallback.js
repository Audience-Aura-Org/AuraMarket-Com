/**
 * services/payment/mobileMoneyFallback.js
 * Mobile Money with a fallback: users only choose "Mobile Money"; the server tries
 * the gateway chosen for the number, then the next one if it clearly failed before
 * charging anything.
 *
 *   pawapay  → payunit → eversend
 *   payunit  → eversend            (Orange numbers start at PayUnit)
 *   eversend                        (never for less than EVERSEND_MIN_XAF)
 *
 * Never falls back after a timeout or an "already pending on your phone" answer:
 * the first prompt may still go through and the customer would be asked twice.
 */
const CHAIN = { pawapay: ['pawapay', 'payunit', 'eversend'], payunit: ['payunit', 'eversend'], eversend: ['eversend'] };
const EVERSEND_MIN_XAF = 500;

/** True when the error proves the attempt never reached the customer's phone. */
const isSafeToFallback = (err) => {
  const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase();
  const code = String(err?.code || '');
  if (['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code) || err?.name === 'AbortError' || /time ?out|timed out/.test(msg)) return false;
  if (/already pending|approve the ussd/.test(msg)) return false;
  return true;
};

/** Gateways to try for a first choice and amount, in order. */
const chainFor = (first, amount) => (CHAIN[first] || [first]).filter((g) => g !== 'eversend' || Number(amount) >= EVERSEND_MIN_XAF);

/**
 * Runs attempt(gateway) along the chain until one succeeds.
 * onFallback(gateway, error) is called for each gateway given up on (to clean up).
 * Throws the first error when nothing is safe to retry, or the last one at the end.
 */
const withMobileMoneyFallback = async (first, amount, attempt, { onFallback } = {}) => {
  const gateways = chainFor(first, amount);
  let firstError = null;
  for (let i = 0; i < gateways.length; i++) {
    try {
      const result = await attempt(gateways[i]);
      return { ...result, gateway: result?.gateway || gateways[i], fallback_used: i > 0 };
    } catch (err) {
      firstError = firstError || err;
      const last = i === gateways.length - 1;
      if (last || !isSafeToFallback(err)) throw i === 0 ? err : firstError;
      console.warn(`[mobileMoney] ${gateways[i]} failed (${err.message}); trying ${gateways[i + 1]}`);
      if (onFallback) await onFallback(gateways[i], err);
    }
  }
  throw firstError || new Error('No Mobile Money route is available.');
};

module.exports = { withMobileMoneyFallback, chainFor, isSafeToFallback, EVERSEND_MIN_XAF };
