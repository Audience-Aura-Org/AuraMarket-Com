import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
const { detectPawaPayProvider, estimateMobileMoneyFee } = await import('./mobileMoneyFees');

describe('estimateMobileMoneyFee', () => {
  it('matches the backend gross-up for PawaPay MTN', () => {
    expect(estimateMobileMoneyFee(10000, 'pawapay', { provider: 'MTN_MOMO_CMR' })).toEqual({ netAmount: 10000, fee: 311, grossAmount: 10311 });
  });

  it('uses the higher PawaPay rate when the network is unknown', () => {
    expect(estimateMobileMoneyFee(10000, 'pawapay').grossAmount).toBe(estimateMobileMoneyFee(10000, 'pawapay', { provider: 'ORANGE_MONEY_CMR' }).grossAmount);
  });

  it('charges nothing for wallet payments', () => {
    expect(estimateMobileMoneyFee(5000, 'wallet').fee).toBe(0);
  });

  it('can leave out the payout reserve (subscriptions)', () => {
    expect(estimateMobileMoneyFee(10000, 'pawapay', { provider: 'MTN_MOMO_CMR', payoutReserve: false }).grossAmount).toBe(Math.ceil(10000 / 0.9825));
  });
});

describe('detectPawaPayProvider', () => {
  it('detects Cameroon networks from the prefix', () => {
    expect(detectPawaPayProvider('677 12 34 56')).toBe('MTN_MOMO_CMR');
    expect(detectPawaPayProvider('+237 699 12 34 56')).toBe('ORANGE_MONEY_CMR');
    expect(detectPawaPayProvider('656123456')).toBe('ORANGE_MONEY_CMR');
    expect(detectPawaPayProvider('65')).toBeNull();
  });
});
