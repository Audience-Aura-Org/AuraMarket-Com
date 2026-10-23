import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('./api', () => ({ default: { get: vi.fn() } }));
import api from './api';
import { pollTransactionStatus } from './paymentProvider';
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('payment verification lifecycle', () => {
  it('does not report success from a response arriving after cancellation', async () => {
    vi.useFakeTimers();let complete;api.get.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
    const success=vi.fn();const stop=pollTransactionStatus('pawapay','ref',{onSuccess:success});
    await vi.advanceTimersByTimeAsync(1000);stop();complete({data:{status:'SUCCESSFUL'}});await Promise.resolve();
    expect(success).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps an unreachable provider pending until the verification deadline', async () => {
    vi.useFakeTimers();api.get.mockRejectedValue(new Error('offline'));const failed=vi.fn(),timeout=vi.fn();
    pollTransactionStatus('payunit','ref',{onFailed:failed,onTimeout:timeout},1000,3000);
    await vi.advanceTimersByTimeAsync(3500);expect(failed).not.toHaveBeenCalled();expect(timeout).toHaveBeenCalledOnce();
  });
  it('stops after a confirmed payment and encodes the reference', async () => {
    vi.useFakeTimers();api.get.mockResolvedValue({data:{status:'SUCCESSFUL',data:{balance:5000}}});const success=vi.fn();
    pollTransactionStatus('eversend','a/b?x',{onSuccess:success});await vi.advanceTimersByTimeAsync(30000);
    expect(success).toHaveBeenCalledOnce();expect(api.get).toHaveBeenCalledOnce();expect(api.get.mock.calls[0][0]).toContain('a%2Fb%3Fx');
  });
});
