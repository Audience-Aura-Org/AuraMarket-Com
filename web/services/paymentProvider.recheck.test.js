import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

import api from '@/services/api';
import { recheckTransaction, recheckWithdrawal } from './paymentProvider';

const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

// Braces matter: a function returned from beforeEach runs as teardown.
beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('recheckTransaction', () => {
  it('returns the outcome on success', async () => {
    api.get.mockResolvedValue({ data: { success: true, status: 'SUCCESSFUL', data: { balance_added: 5000 } } });
    expect((await recheckTransaction('pawapay', 'REF')).status).toBe('SUCCESSFUL');
    expect(api.get).toHaveBeenCalledWith('/payments/pawapay/recheck/REF', { skipClientCache: true });
  });

  it('reads a declined payment from an error response (older servers answer 400)', async () => {
    api.get.mockRejectedValue(httpError(400, { success: false, status: 'FAILED', reason: 'Declined by provider' }));
    const out = await recheckTransaction('payunit', 'REF');
    expect(out.status).toBe('FAILED');
    expect(out.reason).toBe('Declined by provider');
  });

  it('never reports FAILED when the server could not be reached', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    const out = await recheckTransaction('pawapay', 'REF');
    expect(out.status).toBe('PENDING');
    expect(out.unreachable).toBe(true);
  });

  it('a server error without an outcome is PENDING with its message', async () => {
    api.get.mockRejectedValue(httpError(503, { success: false, message: 'Could not reach PawaPay at this time.' }));
    const out = await recheckTransaction('pawapay', 'REF');
    expect(out.status).toBe('PENDING');
    expect(out.message).toMatch(/could not reach pawapay/i);
  });
});

describe('recheckWithdrawal', () => {
  it('uses the user-facing withdrawal endpoint', async () => {
    api.get.mockResolvedValue({ data: { success: true, status: 'FAILED', message: 'Withdrawal failed. Balance restored.' } });
    const out = await recheckWithdrawal('WR1');
    expect(api.get).toHaveBeenCalledWith('/withdrawals/mine/WR1/recheck', { skipClientCache: true });
    expect(out.status).toBe('FAILED');
  });
});
