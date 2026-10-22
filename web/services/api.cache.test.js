import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/authStorage', () => ({ getStoredAuthToken: vi.fn(async () => 't') }));

import api from './api';

let calls;
let originalAdapter;
let online;
beforeEach(() => {
  localStorage.clear();
  calls = [];
  online = true;
  originalAdapter = api.defaults.adapter;
  api.defaults.adapter = async (config) => {
    calls.push(config.url);
    if (!online) {
      const e = new Error('Network Error');
      e.config = config;
      e.request = {};
      throw e;
    }
    return { data: { success: true, n: calls.length }, status: 200, statusText: 'OK', headers: {}, config };
  };
});
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('client GET cache', () => {
  it('serves public catalogue data from the short cache', async () => {
    await api.get('/categories');
    await api.get('/categories');
    expect(calls).toHaveLength(1);
  });

  it.each(['/vendor/analytics', '/vendor/orders', '/vendor/products', '/logistics/dashboard', '/admin/analytics', '/subscriptions/me'])(
    'always fetches live dashboard data (%s) — no stale cards',
    async (url) => {
      const first = await api.get(url);
      const second = await api.get(url);
      expect(calls).toHaveLength(2);
      expect(second.data.n).toBe(2);
      expect(first.data.n).toBe(1);
    },
  );

  it('still falls back to the last copy of live data when offline', async () => {
    await api.get('/vendor/analytics');
    online = false;
    const res = await api.get('/vendor/analytics');
    expect(res.offlineCache).toBe(true);
    expect(res.data.success).toBe(true);
  });
});
