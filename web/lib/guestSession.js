/**
 * Instant Buy Now guest session: a hidden customer account the server creates
 * for a visitor with no account. It is kept apart from the normal sign-in
 * (`aura-auth-storage`), so the rest of the app stays signed out; only the
 * Buy Now popup sends its token. Lives 90 days on this device.
 */
import api from '@/services/api';

const KEY = 'aura-guest-session';

export const getGuestSession = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return saved?.token ? { token: saved.token, user: saved.user || null } : null;
  } catch {
    return null;
  }
};

const saveGuestSession = (session) => {
  try { window.localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* private mode: session lasts this visit */ }
};

export const clearGuestSession = () => {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing stored */ }
};

/** The stored guest session, or a new one from POST /auth/guest. */
export const ensureGuestSession = async () => {
  const existing = getGuestSession();
  if (existing) return existing;
  const res = await api.post('/auth/guest', {});
  const session = { token: res.data?.token, user: res.data?.data?.user || null };
  if (!session.token) throw new Error('Could not start checkout. Please try again.');
  saveGuestSession(session);
  return session;
};

/**
 * After a normal sign-in on this device: the account takes over the guest's
 * orders, then the guest session is forgotten. A rejected session is dropped;
 * a network failure keeps it so the next sign-in tries again.
 * @returns {Promise<number>} orders moved
 */
export const claimGuestSessionAfterLogin = async () => {
  const guest = getGuestSession();
  if (!guest) return 0;
  try {
    const res = await api.post('/auth/guest/claim', { guest_token: guest.token });
    clearGuestSession();
    return Number(res.data?.data?.orders) || 0;
  } catch (err) {
    if (err?.response) clearGuestSession();
    return 0;
  }
};
