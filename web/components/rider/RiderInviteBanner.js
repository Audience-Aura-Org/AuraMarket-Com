'use client';
/**
 * App-wide card for a pending rider invitation, so an invited person who signs in
 * (and lands on onboarding or the shop) can get to it without the email link.
 * Hidden on the Rider page itself; "Later" hides it for this session.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, X } from 'lucide-react';
import { useRiderProfile } from '@/lib/riderProfile';

const KEY = 'aura_rider_invite_later';

export default function RiderInviteBanner() {
  const pathname = usePathname();
  const rider = useRiderProfile();
  const [later, setLater] = useState(true);

  useEffect(() => {
    try { setLater(sessionStorage.getItem(KEY) === '1'); } catch { setLater(false); }
  }, []);

  if (rider?.status !== 'invited' || later || pathname?.startsWith('/rider') || pathname?.startsWith('/onboarding')) return null;
  const hide = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} setLater(true); };

  return (
    <div role="status" className="fixed inset-x-3 z-[140] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#0a050a] p-3 text-white shadow-2xl sm:bottom-6" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Bike className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{rider.agency?.name || 'A delivery agency'} invited you to deliver</p>
        <p className="text-[11px] text-white/70">Accept to start receiving deliveries.</p>
      </div>
      <Link href="/rider" onClick={hide} className="flex min-h-10 shrink-0 items-center rounded-xl bg-[#ff00ff] px-4 text-[12px] font-semibold">View</Link>
      <button type="button" onClick={hide} aria-label="Later" className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/60"><X className="size-4" /></button>
    </div>
  );
}
