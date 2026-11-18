import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/services/api', () => ({ default: { post: (...a) => post(...a) } }));
const { claimGuestSessionAfterLogin, clearGuestSession, ensureGuestSession, getGuestSession } = await import('./guestSession');

beforeEach(() => { post.mockReset(); window.localStorage.clear(); });

describe('guest session', () => {
  it('creates one through /auth/guest and keeps it under aura-guest-session', async () => {
    post.mockResolvedValue({ data: { token: 't1', data: { user: { _id: 'g1', is_guest: true } } } });
    const session = await ensureGuestSession();
    expect(post).toHaveBeenCalledWith('/auth/guest', {});
    expect(session).toEqual({ token: 't1', user: { _id: 'g1', is_guest: true } });
    expect(JSON.parse(window.localStorage.getItem('aura-guest-session')).token).toBe('t1');
    expect(window.localStorage.getItem('aura-auth-storage')).toBeNull();
  });

  it('reuses the stored session instead of making a new guest', async () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'old', user: { _id: 'g0' } }));
    expect(await ensureGuestSession()).toEqual({ token: 'old', user: { _id: 'g0' } });
    expect(post).not.toHaveBeenCalled();
  });

  it('still works when storage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    post.mockResolvedValue({ data: { token: 't2', data: { user: { _id: 'g2' } } } });
    expect((await ensureGuestSession()).token).toBe('t2');
    expect(getGuestSession()).toBeNull();
    vi.restoreAllMocks();
    expect(spy).toBeDefined();
  });

  it('clears it', () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'x', user: {} }));
    clearGuestSession();
    expect(getGuestSession()).toBeNull();
  });

  it('after a normal sign-in, hands the guest orders to the account and forgets the guest', async () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'gtok', user: {} }));
    post.mockResolvedValue({ data: { success: true, data: { orders: 2 } } });
    expect(await claimGuestSessionAfterLogin()).toBe(2);
    expect(post).toHaveBeenCalledWith('/auth/guest/claim', { guest_token: 'gtok' });
    expect(getGuestSession()).toBeNull();
  });

  it('forgets a guest session the server rejects, and does nothing without one', async () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'bad', user: {} }));
    post.mockRejectedValue({ response: { status: 400 } });
    expect(await claimGuestSessionAfterLogin()).toBe(0);
    expect(getGuestSession()).toBeNull();
    post.mockReset();
    expect(await claimGuestSessionAfterLogin()).toBe(0);
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps the guest session when the network fails, to try again next sign-in', async () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'gtok', user: {} }));
    post.mockRejectedValue(new Error('offline'));
    expect(await claimGuestSessionAfterLogin()).toBe(0);
    expect(getGuestSession()).not.toBeNull();
  });
});
