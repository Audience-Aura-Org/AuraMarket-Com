/**
 * The signed-in user's rider profile (GET /riders/me): { status: 'invited' | 'active'
 * | 'inactive', agency: { name } } or null. Riders are ordinary customer accounts,
 * so navigation uses this to show the Rider tab and the invitation banner.
 * Fetched once per session and shared; call refreshRiderProfile() after the
 * rider answers an invitation.
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

const EVENT = 'aura:rider-profile';
let cached = { userId: null, promise: null };

const load = (userId) => {
  if (cached.userId !== userId || !cached.promise) {
    cached = {
      userId,
      promise: api.get('/riders/me', { skipClientCache: true, __skipRetry: true })
        .then((res) => res.data?.data?.rider || null)
        .catch(() => { cached.promise = null; return null; }),
    };
  }
  return cached.promise;
};

export const refreshRiderProfile = () => {
  cached.promise = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
};

export function useRiderProfile() {
  const user = useAuthStore((s) => s.user);
  const userId = user?._id || null;
  // Only customer accounts can be riders.
  const eligible = Boolean(userId) && user?.role === 'customer';
  const [rider, setRider] = useState(null);

  useEffect(() => {
    if (!eligible) { setRider(null); return undefined; }
    let active = true;
    const run = () => load(userId).then((r) => { if (active) setRider(r); });
    run();
    window.addEventListener(EVENT, run);
    return () => { active = false; window.removeEventListener(EVENT, run); };
  }, [eligible, userId]);

  return rider;
}
