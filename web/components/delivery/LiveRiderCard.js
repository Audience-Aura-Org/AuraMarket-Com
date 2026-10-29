'use client';
/**
 * Customer tracking page: the rider's live position while the delivery is under
 * way (feature flag `live_tracking`). Polls every 10 s while the tab is visible.
 * Pass `token` for secure tracking links, or `code` for a signed-in sender/recipient.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bike, Loader2, Phone } from 'lucide-react';
import api from '@/services/api';
import { useGoogleMaps } from '@/lib/googleMaps';

// Google Maps when a key is configured, else the free MapLibre map.
const LiveMap = dynamic(() => (useGoogleMaps ? import('@/components/location/google/GoogleLiveMap') : import('@/components/location/LiveMap')), {
  ssr: false,
  loading: () => <div className="flex h-56 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] sm:h-64"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>,
});

const POLL_MS = 10000;
const VEHICLE = { motorcycle: 'Motorcycle', bicycle: 'Bicycle', car: 'Car', van: 'Van', on_foot: 'On foot' };
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

  const who = live.rider_info;
  const route = live.live ? live.route : null;
  const eta = route ? (route.heading_to === 'pickup' ? route.pickup_eta_min : route.dropoff_eta_min) : null;
  return (
    <div className="space-y-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
      {/* Who is coming, like ride-hailing apps: name, vehicle, plate, call. */}
      {who && (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[14px] font-bold text-[var(--accent)]">{(who.name || 'R')[0].toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{who.name} is delivering</p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">{VEHICLE[who.vehicle_type] || 'Rider'}{who.vehicle_plate ? ` · ${who.vehicle_plate}` : ''}</p>
          </div>
          {who.phone && (
            <a href={`tel:${who.phone}`} aria-label={`Call ${who.name}`} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Phone className="size-4" /></a>
          )}
        </div>
      )}

      {eta != null && (
        <div className="flex items-baseline justify-between gap-2 rounded-xl bg-[var(--bg-primary)] px-3 py-2">
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{route.heading_to === 'pickup' ? 'Going to pick up your package' : 'On the way to you'}</p>
          <p className="shrink-0 text-[12px] tabular-nums text-[var(--text-secondary)]">
            <span className="text-[16px] font-bold text-[var(--accent)]">{eta}</span> min{route.heading_to === 'dropoff' ? ` · ${route.distance_km} km` : ''}
          </p>
        </div>
      )}

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
      {live.live && <LiveMap rider={live.rider} destination={destination || route?.dropoff} route={route} />}
      {eta != null && <p className="text-[10px] text-[var(--text-secondary)]">Times are estimates from the road network and do not include traffic.</p>}
    </div>
  );
}
