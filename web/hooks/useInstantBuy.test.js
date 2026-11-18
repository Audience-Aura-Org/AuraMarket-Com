import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const flags = vi.hoisted(() => ({ value: {} }));
vi.mock('@/services/api', () => ({ default: { get: () => Promise.resolve({ data: { data: { features: flags.value } } }) } }));

describe('useInstantBuy', () => {
  it('is off unless the instant_buy flag is on, so Buy Now keeps its old behaviour', async () => {
    vi.resetModules();
    flags.value = {};
    const { useInstantBuy } = await import('./useInstantBuy');
    const { result } = renderHook(() => useInstantBuy());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.enabled).toBe(false);
  });

  it('when on, open() hands the item to the popup and close() clears it', async () => {
    vi.resetModules();
    flags.value = { instant_buy: true };
    const { useInstantBuy, useInstantBuyStore } = await import('./useInstantBuy');
    const { result } = renderHook(() => useInstantBuy());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    act(() => result.current.open({ item: { productId: 'p1' }, quantity: 2 }));
    expect(useInstantBuyStore.getState().request).toEqual({ item: { productId: 'p1' }, quantity: 2 });
    act(() => useInstantBuyStore.getState().close());
    expect(useInstantBuyStore.getState().request).toBeNull();
  });
});
