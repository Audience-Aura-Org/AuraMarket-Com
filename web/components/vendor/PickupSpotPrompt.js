'use client';
/**
 * Vendor dashboard: asks stores without an exact pickup spot to set one (place
 * search on Account → Store). Riders, routes and arrival times use it; until it is
 * set they fall back to the centre of the store's quartier.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import api from '@/services/api';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function PickupSpotPrompt() {
  const enabled = useFeatureFlag('location_picker');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    api.get('/vendors/me', { skipClientCache: true })
      .then((res) => setMissing(res.data?.data?.vendor?.pickup_address?.location?.lat == null))
      .catch(() => {});
  }, [enabled]);

  if (!enabled || !missing) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600"><MapPin className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Set your exact pickup location</p>
        <p className="text-[11px] text-[var(--text-secondary)]">Search your store&apos;s place or street once so riders come straight to you and customers see accurate arrival times.</p>
      </div>
      <Link href="/profile?tab=store#pickup-spot" className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-[var(--accent)] px-4 text-[12px] font-semibold text-white">Set location</Link>
    </div>
  );
}
