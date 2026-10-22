import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/authStorage', () => ({ getStoredAuthToken: vi.fn(async () => 't') }));

import api from './api';

/** Adapter that fails like a dropped mobile connection (no response). */
const networkFailure = () => {
  const err = new Error('Network Error');
  err.code = 'ERR_NETWORK';
  return err;
};

let calls;
let originalAdapter;
beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  originalAdapter = api.defaults.adapter;
  api.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const e = networkFailure();
    e.config = config;
    e.request = {};
    throw e;
  };
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

const settle = async (promise) => {
  const done = promise.catch((e) => e);
  await vi.runAllTimersAsync();
  return done;
};

describe('automatic retry on a lost response', () => {
  it('retries read-only requests', async () => {
    await settle(api.get('/categories', { skipClientCache: true }));
    expect(calls.length).toBeGreaterThan(1);
  });

  it('never re-sends a checkout (the server may already have charged)', async () => {
    await settle(api.post('/orders/cart-split', { items: [] }));
    expect(calls).toEqual(['POST orders/cart-split']);
  });

  it('never re-sends a withdrawal', async () => {
    await settle(api.post('/withdrawals', { amount: 1000 }));
    expect(calls).toEqual(['POST withdrawals']);
  });

  it('never re-sends PATCH or DELETE', async () => {
    await settle(api.patch('/orders/1/status', { status: 'shipped' }));
    await settle(api.delete('/products/1'));
    expect(calls).toEqual(['PATCH orders/1/status', 'DELETE products/1']);
  });
});
