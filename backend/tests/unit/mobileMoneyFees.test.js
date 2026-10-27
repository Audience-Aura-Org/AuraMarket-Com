import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { applyMobileMoneyCollectionFee, getPublicFeeRates } from '../../utils/mobileMoneyFees';

const ENV_KEYS = ['MOMO_FEE_PAWAPAY_MTN_PCT', 'MOMO_FEE_PAWAPAY_ORANGE_PCT', 'MOMO_FEE_EVERSEND_PCT', 'MOMO_FEE_PAYUNIT_PCT', 'MOMO_PAYOUT_FEE_PCT', 'MOMO_FEE_FIXED_XAF'];
let saved;
beforeEach(() => { saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])); ENV_KEYS.forEach((k) => delete process.env[k]); });
afterEach(() => ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

describe('applyMobileMoneyCollectionFee', () => {
  it('grosses up PawaPay MTN so the deposit and its later payout are both covered', () => {
    const fee = applyMobileMoneyCollectionFee(10000, 'pawapay', 'XAF', { provider: 'MTN_MOMO_CMR' });
    // ceil(10000 * 1.013 / (1 - 0.0175)) = ceil(10310.43)
    expect(fee).toMatchObject({ netAmount: 10000, grossAmount: 10311, collectionFee: 311 });
  });

  it('uses the higher PawaPay rate when the provider is unknown (hosted checkout)', () => {
    const unknown = applyMobileMoneyCollectionFee(10000, 'pawapay', 'XAF');
    const orange = applyMobileMoneyCollectionFee(10000, 'pawapay', 'XAF', { provider: 'ORANGE_MONEY_CMR' });
    expect(unknown.grossAmount).toBe(orange.grossAmount);
    expect(unknown.collectionRate).toBeCloseTo(0.0177);
  });

  it('skips the payout reserve for money that never leaves the platform', () => {
    const fee = applyMobileMoneyCollectionFee(10000, 'pawapay', 'XAF', { provider: 'MTN_MOMO_CMR', payoutReserve: false });
    expect(fee.grossAmount).toBe(Math.ceil(10000 / (1 - 0.0175)));
    expect(fee.payoutRate).toBe(0);
  });

  it('charges nothing for wallet payments, non-XAF currencies or zero amounts', () => {
    expect(applyMobileMoneyCollectionFee(5000, 'wallet').collectionFee).toBe(0);
    expect(applyMobileMoneyCollectionFee(5000, 'eversend', 'NGN').collectionFee).toBe(0);
    expect(applyMobileMoneyCollectionFee(0, 'pawapay').grossAmount).toBe(0);
  });

  it('follows env overrides, including a fixed XAF part', () => {
    process.env.MOMO_FEE_EVERSEND_PCT = '2';
    process.env.MOMO_PAYOUT_FEE_PCT = '0';
    process.env.MOMO_FEE_FIXED_XAF = '20';
    expect(applyMobileMoneyCollectionFee(980, 'eversend').grossAmount).toBe(1021); // (980 + 20) / 0.98 = 1020.4
    expect(getPublicFeeRates().collection.eversend).toBeCloseTo(0.02);
  });

  it('always leaves enough after the gateway cut to pay the net back out', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5_000_000 }),
      fc.constantFrom('pawapay', 'payunit', 'eversend'),
      fc.constantFrom('MTN_MOMO_CMR', 'ORANGE_MONEY_CMR', null),
      (net, gateway, provider) => {
        const fee = applyMobileMoneyCollectionFee(net, gateway, 'XAF', { provider });
        const received = fee.grossAmount * (1 - fee.collectionRate);
        expect(received + 1e-6).toBeGreaterThanOrEqual(net * (1 + fee.payoutRate));
        expect(fee.grossAmount - 1).toBeLessThan((net * (1 + fee.payoutRate)) / (1 - fee.collectionRate) + 1e-6);
      }
    ));
  });
});
