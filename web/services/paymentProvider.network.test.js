import { describe, it, expect, vi } from 'vitest';
vi.mock('./api', () => ({ default: { get: vi.fn() } }));
import { detectCameroonNetwork, resolveCameroonMobileMoneyGateway } from './paymentProvider';

describe('MTN / Orange logo detection', () => {
  it('names the network from the first three digits, in any format', () => {
    expect(detectCameroonNetwork('677 12 34 56')).toBe('mtn');
    expect(detectCameroonNetwork('+237 651188134')).toBe('mtn');
    expect(detectCameroonNetwork('68')).toBe(null);
    expect(detectCameroonNetwork('680')).toBe('mtn');
    expect(detectCameroonNetwork('699000000')).toBe('orange');
    expect(detectCameroonNetwork('00237 655 00 00 00')).toBe('orange');
  });
  it('shows no logo for other networks or an empty field', () => {
    expect(detectCameroonNetwork('')).toBe(null);
    expect(detectCameroonNetwork('666123456')).toBe(null); // Nexttel
    expect(detectCameroonNetwork('233123456')).toBe(null); // landline
  });
  it('agrees with the payment routing for Orange numbers', () => {
    expect(resolveCameroonMobileMoneyGateway('699000000').network).toBe('orange');
    expect(resolveCameroonMobileMoneyGateway('677000000').network).toBe('mtn');
  });
});
