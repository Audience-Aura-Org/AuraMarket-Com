'use client';
/**
 * Customer tracking page: the rider's live position while the delivery is under
 * way (feature flag `live_tracking`). Polls every 10 s while the tab is visible.
 * Pass `token` for secure tracking links, or `code` for a signed-in sender/recipient.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bike, Loader2 } from 'lucide-react';
import api from '@/services/api';

const LiveMap = dynamic(() => import('@/components/location/LiveMap'), {
  ssr: false,
  loading: () => <div className="flex h-56 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] sm:h-64"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>,
});

const POLL_MS = 10000;
const ago = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
};

export default function LiveRiderCard({ token, code, destination }) {
  const [live, setLive] = useState(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const url = token ? `/track/${encodeURIComponent(token)}/live` : `/p2p/track/${encodeURIComponent(code)}/live`;
    try { const res = await api.get(url, { skipClientCache: true }); setLive(res.data?.data || null); } catch { /* keep the last position */ }
  }, [token, code]);

  useEffect(() => {
    load();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  if (!live || live.reason === 'disabled' || live.reason === 'not_under_way' || live.reason === 'no_rider') return null;

  return (
    <div className="space-y-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
          <span className="relative flex size-2">
            {live.live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-60" />}
            <span className={`relative inline-flex size-2 rounded-full ${live.live ? 'bg-blue-600' : 'bg-[var(--text-secondary)]/40'}`} />
          </span>
          <Bike className="size-4" /> {live.live ? 'Rider location' : 'Waiting for the rider’s location'}
        </p>
        {live.live && <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">Updated {ago(live.rider.at)}</span>}
      </div>
      {live.live && <LiveMap rider={live.rider} destination={destination} />}
    </div>
  );
}
