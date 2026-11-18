'use client';
/**
 * Someone signed in on a phone that also holds an Instant Buy Now guest
 * session. Phones are often shared, so the guest's orders join this account
 * only if they say so; "Not mine" just forgets the guest session here.
 */
import { useEffect, useState } from 'react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { claimGuestSessionAfterLogin, clearGuestSession, getGuestSession } from '@/lib/guestSession';

export default function GuestClaimPrompt() {
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const guest = getGuestSession();
    if (!guest) return;
    let active = true;
    api.get('/orders/my-orders', { headers: { Authorization: `Bearer ${guest.token}` }, skipClientCache: true, __skipRetry: true })
      .then((res) => {
        if (!active) return;
        const n = Number(res?.data?.count ?? res?.data?.data?.orders?.length) || 0;
        if (n > 0) setCount(n);
        else clearGuestSession();
      })
      .catch((err) => { if (err?.response) clearGuestSession(); });
    return () => { active = false; };
  }, [user]);

  if (!user || !count) return null;

  const add = async () => {
    setBusy(true);
    await claimGuestSessionAfterLogin();
    setBusy(false);
    setCount(0);
  };
  const decline = () => { clearGuestSession(); setCount(0); };

  return (
    <div className="fixed inset-0 z-[9500] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Orders from this phone">
      <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 font-poppins shadow-2xl">
        <p className="text-sm font-semibold leading-relaxed">
          Add the {count} {count === 1 ? 'order' : 'orders'} bought on this phone without an account to your account?
        </p>
        <p className="text-xs text-[var(--text-secondary)]">Only if you placed {count === 1 ? 'it' : 'them'}. Someone else may have used this phone.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={decline} disabled={busy} className="h-11 rounded-2xl border border-[var(--glass-border)] text-sm font-semibold">Not mine</button>
          <button type="button" onClick={add} disabled={busy} className="h-11 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-50">Add to my account</button>
        </div>
      </div>
    </div>
  );
}
