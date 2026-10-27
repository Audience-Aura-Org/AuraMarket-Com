/**
 * Client-side estimate of the mobile money fee (mirrors backend
 * utils/mobileMoneyFees.js). The backend is authoritative: the amount the
 * customer is charged comes from the initialize response (gross_amount).
 *
 *   gross = ceil((net * (1 + payout) + fixed) / (1 - collection))
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';

export const DEFAULT_FEE_RATES = {
  currency: 'XAF',
  collection: {
    pawapay: { MTN_MOMO_CMR: 0.0175, ORANGE_MONEY_CMR: 0.0177, default: 0.0177 },
    eversend: 0.0142,
    payunit: 0.0177,
  },
  payout: 0.013,
  fixed: 0,
};

export const isMobileMoneyGateway = (gateway) => ['pawapay', 'payunit', 'eversend'].includes(gateway);

/** Cameroon prefixes: Orange 655-659 / 69x, otherwise MTN (mirrors pawapay.detectProvider). */
export const detectPawaPayProvider = (phone) => {
  const local = String(phone || '').replace(/\D/g, '').replace(/^237/, '').replace(/^0/, '');
  if (local.length < 3) return null;
  const prefix3 = Number(local.slice(0, 3));
  return (prefix3 >= 655 && prefix3 <= 659) || [69, 62].includes(Number(local.slice(0, 2))) ? 'ORANGE_MONEY_CMR' : 'MTN_MOMO_CMR';
};

/**
 * @param {number} amount net amount the wallet/order must receive
 * @param {string} gateway
 * @param {{ provider?: string|null, payoutReserve?: boolean, rates?: object }} options
 * @returns {{ netAmount, fee, grossAmount }}
 */
export const estimateMobileMoneyFee = (amount, gateway, { provider = null, payoutReserve = true, rates = DEFAULT_FEE_RATES } = {}) => {
  const netAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (!netAmount || !isMobileMoneyGateway(gateway)) return { netAmount, fee: 0, grossAmount: netAmount };
  const configured = rates.collection?.[gateway];
  const collection = configured && typeof configured === 'object' ? (configured[provider] ?? configured.default) : configured;
  const payout = payoutReserve ? Number(rates.payout) || 0 : 0;
  const grossAmount = Math.ceil(Number((((netAmount * (1 + payout)) + (Number(rates.fixed) || 0)) / (1 - (Number(collection) || 0))).toFixed(4)));
  return { netAmount, fee: grossAmount - netAmount, grossAmount };
};

/** Live rates from GET /payments/fees, falling back to the published defaults. */
export const useMobileMoneyFeeRates = () => {
  const [rates, setRates] = useState(DEFAULT_FEE_RATES);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get('/payments/fees');
        if (active && res?.data?.success && res.data.data?.collection) setRates(res.data.data);
      } catch { /* keep the published defaults */ }
    })();
    return () => { active = false; };
  }, []);
  return rates;
};
