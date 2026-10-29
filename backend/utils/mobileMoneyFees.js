/**
 * Mobile money fees passed on to the payer.
 *
 * The customer is charged a gross amount large enough that, after the gateway
 * takes its collection cut, the platform still holds the full net amount PLUS
 * the cost of paying that amount back out later (PawaPay payout). A wallet
 * credited with `net` can therefore be withdrawn in full without loss.
 *
 *   gross = ceil((net * (1 + payoutRate) + fixed) / (1 - collectionRate))
 *
 * Rates are percentages in env so they can follow the gateway contracts
 * without a deploy. Defaults are the published Cameroon rates (Oct 2026):
 *   PawaPay  collection MTN 1.75%, Orange 1.77%; payout MTN 1.3%, Orange 1%
 *   Eversend collection 1.42%
 *   PayUnit  unpublished — defaults to the highest known collection rate.
 */

const pct = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 && value < 50 ? value / 100 : fallback / 100;
};

const getFeeConfig = () => ({
  collection: {
    pawapay: {
      MTN_MOMO_CMR: pct('MOMO_FEE_PAWAPAY_MTN_PCT', 1.75),
      ORANGE_MONEY_CMR: pct('MOMO_FEE_PAWAPAY_ORANGE_PCT', 1.77),
    },
    eversend: pct('MOMO_FEE_EVERSEND_PCT', 1.42),
    payunit: pct('MOMO_FEE_PAYUNIT_PCT', 1.77),
  },
  // Withdrawals are paid out through PawaPay MTN (see pawaWithdrawalApproval).
  payout: pct('MOMO_PAYOUT_FEE_PCT', 1.3),
  // Admin Settings value when set, else MOMO_FEE_FIXED_XAF.
  fixed: Math.max(0, Math.round(Number(require('./runtimeSettings').get('momo_fixed_fee_xaf') ?? process.env.MOMO_FEE_FIXED_XAF ?? 0)) || 0),
});

const MOBILE_MONEY_GATEWAYS = new Set(['eversend', 'payunit', 'pawapay']);

const isMobileMoneyGateway = (gateway) =>
  MOBILE_MONEY_GATEWAYS.has(String(gateway || '').toLowerCase());

/** Collection rate for a gateway/provider; unknown PawaPay provider uses the highest rate. */
const getCollectionRate = (gateway, provider = null, config = getFeeConfig()) => {
  const key = String(gateway || '').toLowerCase();
  const rate = config.collection[key];
  if (rate && typeof rate === 'object') return rate[provider] ?? Math.max(...Object.values(rate));
  return rate || 0;
};

/**
 * @param {number} amount   net amount that must reach the platform (wallet credit / order total)
 * @param {string} gateway  'pawapay' | 'payunit' | 'eversend' | anything else (no fee)
 * @param {string} currency only XAF is surcharged
 * @param {{ provider?: string|null, payoutReserve?: boolean }} options
 *   provider: PawaPay correspondent (MTN_MOMO_CMR / ORANGE_MONEY_CMR) when known
 *   payoutReserve: false when the money never leaves the platform (subscriptions)
 */
const applyMobileMoneyCollectionFee = (amount, gateway, currency = 'XAF', { provider = null, payoutReserve = true } = {}) => {
  const netAmount = Math.max(0, Math.round(Number(amount || 0)));
  if (!netAmount || !isMobileMoneyGateway(gateway) || String(currency || 'XAF').toUpperCase() !== 'XAF') {
    return { netAmount, collectionFee: 0, grossAmount: netAmount, collectionRate: 0, payoutRate: 0 };
  }
  const config = getFeeConfig();
  const collectionRate = getCollectionRate(gateway, provider, config);
  const payoutRate = payoutReserve ? config.payout : 0;
  const required = netAmount * (1 + payoutRate) + config.fixed;
  // Round to 4dp before ceil so float noise (e.g. 1000.0000000001) doesn't add 1 XAF.
  const grossAmount = Math.ceil(Number((required / (1 - collectionRate)).toFixed(4)));
  return { netAmount, collectionFee: grossAmount - netAmount, grossAmount, collectionRate, payoutRate };
};

/** Public rates for the client-side estimate (backend stays authoritative). */
const getPublicFeeRates = () => {
  const config = getFeeConfig();
  return {
    currency: 'XAF',
    collection: {
      pawapay: { ...config.collection.pawapay, default: getCollectionRate('pawapay', null, config) },
      eversend: config.collection.eversend,
      payunit: config.collection.payunit,
    },
    payout: config.payout,
    fixed: config.fixed,
    // Lets the client route Orange numbers to PawaPay once it is enabled there.
    pawapay_orange_enabled: process.env.PAWAPAY_ORANGE_ENABLED === 'true',
  };
};

module.exports = {
  applyMobileMoneyCollectionFee,
  getCollectionRate,
  getPublicFeeRates,
  isMobileMoneyGateway,
};
