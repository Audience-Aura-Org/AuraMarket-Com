"use client";
/**
 * New delivery offer, shown over whichever rider tab is open, with a countdown
 * ring and big Accept / Decline buttons, and "Later" to put it aside: it then waits
 * on Home ("Offers for you") until it expires. One offer at a time, oldest first.
 */
import { useEffect, useState } from "react";
import { Banknote, Check, Clock, Loader2, MapPin, Package, X } from "lucide-react";
import { secondsLeft, useRiderJobs } from "./RiderJobsContext";

const R = 26;
const C = 2 * Math.PI * R;

export default function RiderOfferSheet() {
  const jobs = useRiderJobs();
  const [, tick] = useState(0);
  const offer = jobs?.data?.offers?.find((o) => secondsLeft(o.expires_at) > 0 && !jobs.later.has(String(o.assignment_id)));

  useEffect(() => {
    if (!offer) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [offer]);

  if (!offer) return null;
  const left = secondsLeft(offer.expires_at);
  const total = Math.max(left, Math.round((new Date(offer.expires_at) - new Date(offer.offered_at)) / 1000) || left);
  const s = offer.shipment;
  const busy = jobs.busy === `acc-${offer.assignment_id}` || jobs.busy === `rej-${offer.assignment_id}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[600] p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:bottom-24 sm:mx-auto sm:max-w-md" role="alertdialog" aria-labelledby="offer-title" aria-describedby="offer-route">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/40" aria-hidden="true" />
      <div className="space-y-4 rounded-[28px] border border-[var(--accent)]/40 bg-[var(--bg-primary)] p-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0">
            <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r={R} fill="none" stroke="var(--glass-border)" strokeWidth="6" />
              <circle cx="32" cy="32" r={R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums" aria-label={`${left} seconds left`}>{left}</span>
          </div>
          <div className="min-w-0">
            <p id="offer-title" className="text-[17px] font-bold">New delivery</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{s.tracking_code} · answer before the timer ends</p>
          </div>
        </div>

        <div id="offer-route" className="space-y-2.5 rounded-2xl bg-[var(--bg-secondary)] p-3.5">
          <p className="flex items-start gap-2.5 text-[13px]"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#111827]" /><span><span className="block text-[10px] text-[var(--text-secondary)]">Pickup</span><span className="font-semibold">{[s.pickup?.landmark || s.pickup?.street, s.pickup?.quartier].filter(Boolean).join(", ") || "—"}</span></span></p>
          <p className="flex items-start gap-2.5 text-[13px]"><MapPin className="mt-0.5 size-4 shrink-0 text-[#ff00ff]" /><span><span className="block text-[10px] text-[var(--text-secondary)]">Drop-off</span><span className="font-semibold">{[s.delivery?.landmark || s.delivery?.street, s.delivery?.quartier].filter(Boolean).join(", ") || "—"}</span></span></p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-2.5 py-1"><Package className="size-3.5" /> {s.package?.description || s.package?.category || "Package"}{s.package?.weight_tier ? ` · ${s.package.weight_tier.replace("_", " ")}` : ""}</span>
          {s.cash_to_collect > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-700"><Banknote className="size-3.5" /> Collect {Number(s.cash_to_collect).toLocaleString()} XAF</span>}
        </div>

        <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
          <button type="button" disabled={busy} onClick={() => jobs.decline(offer)} className="inline-flex min-h-14 items-center justify-center gap-1.5 rounded-2xl border border-[var(--glass-border)] text-[13px] font-semibold disabled:opacity-50"><X className="size-4" /> Decline</button>
          <button type="button" disabled={busy} onClick={() => jobs.putAside(offer)} className="inline-flex min-h-14 items-center justify-center gap-1.5 rounded-2xl border border-[var(--glass-border)] text-[13px] font-semibold disabled:opacity-50"><Clock className="size-4" /> Later</button>
          <button type="button" disabled={busy} onClick={() => jobs.accept(offer)} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[15px] font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Accept</button>
        </div>
      </div>
    </div>
  );
}
