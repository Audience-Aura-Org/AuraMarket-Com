import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/services/socket', () => ({ default: { on: vi.fn(), off: vi.fn(), disconnect: vi.fn() } }));
vi.mock('@/services/authStorage', () => ({
  clearStoredAuthToken: vi.fn(), setStoredAuthToken: vi.fn(), getStoredAuthToken: vi.fn(async () => 't'),
}));
vi.mock('@/lib/pwa-helper', () => ({ unsubscribeCurrentPushEndpoint: vi.fn(async () => {}) }));
vi.mock('@/lib/native-push', () => ({ unregisterNativeAndroidPushToken: vi.fn(async () => {}) }));

import api from '@/services/api';
import { useAuthStore } from './useAuth';
import { useWalletBalance } from './useWalletBalance';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const balanceResponse = (balance) => ({ data: { success: true, data: { balance } } });
const walletCalls = () => api.get.mock.calls.filter(([url]) => url === '/wallet').length;

beforeEach(() => {
  api.get.mockReset();
  useAuthStore.setState({ user: { _id: 'u1', role: 'customer' }, isAuthenticated: true, walletBalance: 10_000 });
});

describe('wallet balance ordering', () => {
  it('a refresh that started before a newer balance does not overwrite it', async () => {
    const read = deferred();
    api.get.mockReturnValueOnce(read.promise);
    const refreshing = useAuthStore.getState().refreshWalletBalance();

    useAuthStore.getState().setWalletBalance(8_000); // e.g. withdrawal response / socket push
    read.resolve(balanceResponse(10_000));           // stale read lands afterwards
    await refreshing;

    expect(useAuthStore.getState().walletBalance).toBe(8_000);
  });

  it('when two refreshes overlap, the one started last wins', async () => {
    const first = deferred();
    const second = deferred();
    api.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const a = useAuthStore.getState().refreshWalletBalance();
    const b = useAuthStore.getState().refreshWalletBalance();

    second.resolve(balanceResponse(7_000));
    await b;
    first.resolve(balanceResponse(9_000));
    await a;

    expect(useAuthStore.getState().walletBalance).toBe(7_000);
  });

  it('applies a refresh when nothing newer happened', async () => {
    api.get.mockResolvedValueOnce(balanceResponse(5_500));
    await useAuthStore.getState().refreshWalletBalance();
    expect(useAuthStore.getState().walletBalance).toBe(5_500);
  });

  it('a page read stamped before a push cannot overwrite the push', () => {
    const { startBalanceRead, setWalletBalance } = useAuthStore.getState();
    const stamp = startBalanceRead();
    setWalletBalance(3_000);
    setWalletBalance(12_000, { readStamp: stamp });
    expect(useAuthStore.getState().walletBalance).toBe(3_000);
  });
});

describe('useWalletBalance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.get.mockResolvedValue(balanceResponse(10_000));
  });
  afterEach(() => vi.useRealTimers());

  it('mounting several consumers performs one balance request', async () => {
    renderHook(() => useWalletBalance());
    renderHook(() => useWalletBalance());
    renderHook(() => useWalletBalance());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(walletCalls()).toBe(1);
  });

  it('navigation triggers a single refresh regardless of consumer count', async () => {
    renderHook(() => useWalletBalance());
    renderHook(() => useWalletBalance());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const before = walletCalls();
    act(() => { window.history.pushState({}, '', '/wallet'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(walletCalls()).toBe(before + 1);
  });

  it('restores history.pushState once every consumer has unmounted, in any order', () => {
    const original = window.history.pushState;
    const a = renderHook(() => useWalletBalance());
    const b = renderHook(() => useWalletBalance());
    a.unmount();
    expect(window.history.pushState).not.toBe(original); // b still listening
    b.unmount();
    expect(window.history.pushState).toBe(original);
  });

  it('exposes the shared store balance', () => {
    const { result } = renderHook(() => useWalletBalance());
    act(() => { useAuthStore.getState().setWalletBalance(4_200); });
    expect(result.current.walletBalance).toBe(4_200);
  });
});

describe('balance writes do not churn the user object', () => {
  it('setWalletBalance keeps the same `user` reference, so pages keyed on user do not reload', () => {
    const userBefore = useAuthStore.getState().user;
    useAuthStore.getState().setWalletBalance(12_345);
    expect(useAuthStore.getState().walletBalance).toBe(12_345);
    expect(useAuthStore.getState().user).toBe(userBefore);
  });
});
