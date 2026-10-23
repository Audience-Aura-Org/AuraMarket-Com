import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tokenStore = { value: null };
vi.mock('@/services/authStorage', () => ({
  getStoredAuthToken: vi.fn(async () => tokenStore.value),
  clearStoredAuthToken: vi.fn(async () => { tokenStore.value = null; }),
}));

import api from './api';

const reply401 = (message) => async (config) => {
  const e = new Error('401');
  e.config = config;
  e.response = { status: 401, data: { success: false, message }, headers: {}, config };
  throw e;
};

let events;
const onInvalid = () => events.push('invalidated');
let originalAdapter;
let clock = Date.now();
beforeEach(() => {
  // The client debounces logouts for 15 s; give each test its own moment.
  clock += 60_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  localStorage.clear();
  tokenStore.value = null;
  events = [];
  window.addEventListener('aura:session-invalidated', onInvalid);
  originalAdapter = api.defaults.adapter;
});
afterEach(() => {
  window.removeEventListener('aura:session-invalidated', onInvalid);
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});

const savedSignedIn = () => localStorage.setItem('aura-auth-storage', JSON.stringify({
  state: { user: { _id: 'u1' }, token: null, isAuthenticated: true }, version: 0,
}));

describe('ending a session the server no longer accepts', () => {
  it('a saved "signed in" state with no token is ended on "No token provided"', async () => {
    savedSignedIn();
    api.defaults.adapter = reply401('Access denied. No token provided.');
    await api.get('/orders', { skipClientCache: true }).catch(() => {});
    expect(events).toEqual(['invalidated']);
    expect(localStorage.getItem('aura-auth-storage')).toBeNull();
  });

  it('an expired token ends the session (server wording)', async () => {
    tokenStore.value = 'old-token';
    api.defaults.adapter = reply401('Your session has expired. Please log in again.');
    await api.get('/orders', { skipClientCache: true }).catch(() => {});
    expect(events).toEqual(['invalidated']);
  });

  it('a guest hitting a protected route is NOT redirected to login', async () => {
    api.defaults.adapter = reply401('Access denied. No token provided.');
    await api.get('/cart', { skipClientCache: true }).catch(() => {});
    expect(events).toEqual([]);
  });

  it('a wrong current password does NOT log a signed-in user out', async () => {
    tokenStore.value = 'good-token';
    api.defaults.adapter = reply401('Current password is incorrect.');
    await api.patch('/users/password', {}).catch(() => {});
    expect(events).toEqual([]);
  });

  it('does not authorize using a cached token after its credential was removed', async () => {
    localStorage.setItem('aura-auth-storage', JSON.stringify({ state: { token: 'saved-tok', isAuthenticated: true }, version: 0 }));
    let auth;
    api.defaults.adapter = async (config) => { auth = config.headers.Authorization; return { data: { success: true }, status: 200, headers: {}, config }; };
    await api.get('/orders', { skipClientCache: true });
    expect(auth).toBeUndefined();
  });
});
