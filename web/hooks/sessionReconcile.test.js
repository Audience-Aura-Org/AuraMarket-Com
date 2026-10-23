import { describe, it, expect, vi, beforeEach } from 'vitest';

const tokenStore = { value: null };
vi.mock('@/services/authStorage', () => ({
  getStoredAuthToken: vi.fn(async () => tokenStore.value),
  setStoredAuthToken: vi.fn(async (t) => { tokenStore.value = t; }),
  clearStoredAuthToken: vi.fn(async () => { tokenStore.value = null; }),
}));
vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(async () => ({})) } }));
vi.mock('@/services/socket', () => ({ default: { on: vi.fn(), off: vi.fn(), disconnect: vi.fn() } }));
vi.mock('@/lib/pwa-helper', () => ({ unsubscribeCurrentPushEndpoint: vi.fn(async () => {}) }));
vi.mock('@/lib/native-push', () => ({ unregisterNativeAndroidPushToken: vi.fn(async () => {}) }));

import { useAuthStore, reconcileHydratedSession } from './useAuth';

const signedIn = (token) => useAuthStore.setState({
  user: { _id: 'u1', name: 'Ada', role: 'customer' }, token, isAuthenticated: true,
});

beforeEach(() => { tokenStore.value = null; });

describe('startup: a session exists only while a token exists', () => {
  it('hydrates a persisted session during module initialization without accessing an uninitialized store', async () => {
    vi.resetModules();
    tokenStore.value = 'startup-token';
    localStorage.setItem('aura-auth-storage', JSON.stringify({
      state: { user: { _id: 'startup-user', role: 'vendor' }, token: 'startup-token', isAuthenticated: true }, version: 0,
    }));
    const { useAuthStore: freshStore } = await import('./useAuth');
    await vi.waitFor(() => expect(freshStore.getState().hasHydrated).toBe(true));
    expect(freshStore.getState().user._id).toBe('startup-user');
    expect(freshStore.getState().token).toBe('startup-token');
  });
  it('a saved "signed in" state with no token anywhere is signed out', async () => {
    signedIn(null);
    await reconcileHydratedSession();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });

  it('keeps the session when the token is stored', async () => {
    tokenStore.value = 'tok-1';
    signedIn('tok-1');
    await reconcileHydratedSession();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('does not resurrect a removed token from cached UI state', async () => {
    signedIn('tok-2');
    await reconcileHydratedSession();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(tokenStore.value).toBeNull();
  });

  it('leaves a signed-out visitor alone', async () => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    await reconcileHydratedSession();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
