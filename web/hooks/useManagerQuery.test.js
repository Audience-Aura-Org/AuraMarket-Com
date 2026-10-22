import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

import api from '@/services/api';
import { useManagerQuery } from './useManagerQuery';

const ok = (data) => Promise.resolve({ data: { success: true, data } });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => api.get.mockReset());

describe('useManagerQuery', () => {
  it('sets loading on first fetch then exposes data', async () => {
    api.get.mockReturnValueOnce(ok([1, 2]));
    const { result } = renderHook(() => useManagerQuery('/manager/accounts'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([1, 2]);
    expect(result.current.error).toBeNull();
  });

  it('keeps previous data and sets refreshing on refetch', async () => {
    api.get.mockReturnValueOnce(ok(['a']));
    const { result } = renderHook(() => useManagerQuery('/manager/accounts'));
    await waitFor(() => expect(result.current.data).toEqual(['a']));

    const next = deferred();
    api.get.mockReturnValueOnce(next.promise);
    act(() => { result.current.refetch(); });
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.data).toEqual(['a']);
    expect(result.current.loading).toBe(false);

    await act(async () => { next.resolve({ data: { success: true, data: ['b'] } }); });
    await waitFor(() => expect(result.current.data).toEqual(['b']));
    expect(result.current.refreshing).toBe(false);
  });

  it('exposes the API message as error and clears it on successful retry', async () => {
    api.get.mockReturnValueOnce(Promise.reject({ response: { data: { message: 'Nope' } } }));
    const { result } = renderHook(() => useManagerQuery('/manager/money'));
    await waitFor(() => expect(result.current.error).toBe('Nope'));

    api.get.mockReturnValueOnce(ok({ fine: true }));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ fine: true });
  });

  it('ignores a response for params that are no longer current', async () => {
    const slow = deferred();
    api.get.mockReturnValueOnce(slow.promise).mockReturnValueOnce(ok('second'));
    const { result, rerender } = renderHook(
      ({ params }) => useManagerQuery('/manager/tasks', params),
      { initialProps: { params: { type: 'order' } } }
    );
    rerender({ params: { type: 'kyc' } });
    await waitFor(() => expect(result.current.data).toBe('second'));

    await act(async () => { slow.resolve({ data: { success: true, data: 'first' } }); });
    expect(result.current.data).toBe('second');
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useManagerQuery('/manager/tasks', null, { enabled: false }));
    expect(api.get).not.toHaveBeenCalled();
  });
});
