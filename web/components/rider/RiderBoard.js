"use client";
/**
 * Rider Home sections:
 *   RiderOffers — every live offer for this rider (including ones put aside with
 *     "Later"), each with its timer and Accept / Decline.
 *   RiderOpenDeliveries — the agency's deliveries still waiting for a rider, nearest
 *     pickup first. The rider can take any of them (even one offered to someone else
 *     who has not answered); contacts show once it is theirs.
 * Data and actions come from RiderJobsContext.
 */
import { useEffect, useState } from "react";
import { Banknote, Check, Clock, Hand, Loader2, MapPin, PackageSearch, RefreshCw, X } from "lucide-react";
import { secondsLeft, useRiderJobs } from "./RiderJobsContext";

const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const stop = (a) => [a?.landmark, a?.quartier].filter(Boolean).join(", ") || "—";

function Route({ from, to }) {
  return (
    <div className="space-y-1 text-[12px]">
      <p className="flex items-start gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#111827]" /><span className="min-w-0 truncate"><span className="font-semibold">{stop(from)}</span></span></p>
      <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[#ff00ff]" /><span className="min-w-0 truncate"><span className="font-semibold">{stop(to)}</span></span></p>
    </div>
  );
}

export function RiderOffers() {
  const jobs = useRiderJobs();
  const [, tick] = useState(0);
  const offers = (jobs?.data?.offers || []).filter((o) => secondsLeft(o.expires_at) > 0);
  useEffect(() => {
    if (!offers.length) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [offers.length]);
  if (!offers.length) return null;

  return (
    <section aria-labelledby="offers-title" className="space-y-2">
      <h2 id="offers-title" className="text-[13px] font-bold">Offers for you <span className="font-normal text-[var(--text-secondary)]">({offers.length})</span></h2>
      {offers.map((o) => {
        const s = o.shipment;
        const left = secondsLeft(o.expires_at);
        const busy = jobs.busy === `acc-${o.assignment_id}` || jobs.busy === `rej-${o.assignment_id}`;
        return (
          <div key={o.assignment_id} className="space-y-3 rounded-3xl border-2 border-[var(--accent)]/40 bg-[var(--accent)]/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">{s.tracking_code}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${left < 60 ? "bg-rose-500/10 text-rose-600" : "bg-[var(--bg-primary)]"}`}><Clock className="size-3.5" /> {mmss(left)}</span>
            </div>
            <Route from={s.pickup} to={s.delivery} />
            {s.cash_to_collect > 0 && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><Banknote className="size-4" /> Collect {xaf(s.cash_to_collect)}</p>}
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <button type="button" disabled={busy} onClick={() => jobs.decline(o)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[12px] font-semibold disabled:opacity-50"><X className="size-4" /> Decline</button>
              <button type="button" disabled={busy} onClick={() => jobs.accept(o)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function RiderOpenDeliveries() {
  const jobs = useRiderJobs();
  const [refreshing, setRefreshing] = useState(false);
  if (!jobs?.data) return null;
  if (jobs.data.availability === "offline") return null;
  const list = jobs.open;

  return (
    <section aria-labelledby="open-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="open-title" className="text-[13px] font-bold">Waiting for a rider {list?.length ? <span className="font-normal text-[var(--text-secondary)]">({list.length})</span> : null}</h2>
        <button type="button" aria-label="Refresh" disabled={refreshing} onClick={async () => { setRefreshing(true); await jobs.loadOpen(); setRefreshing(false); }} className="flex size-9 items-center justify-center rounded-xl border border-[var(--glass-border)]"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /></button>
      </div>
      {list === null ? (
        <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>
      ) : !list.length ? (
        <div className="flex items-center gap-3 rounded-3xl border border-dashed border-[var(--glass-border)] p-4 text-[11px] text-[var(--text-secondary)]">
          <PackageSearch className="size-6 shrink-0 opacity-50" /> No delivery is waiting in your agency right now.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((d) => {
            const busy = jobs.busy === `take-${d.id}`;
            return (
              <li key={d.id} className="space-y-2.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">{d.tracking_code}{d.distance_km != null ? ` · ${d.distance_km} km to pickup` : ""}</p>
                  {d.offered_to_other && <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Offered to another rider</span>}
                </div>
                <Route from={d.pickup} to={d.delivery} />
                <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--text-secondary)]">
                  {d.package?.description && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5">{d.package.description}</span>}
                  {d.package?.weight_tier && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-0.5">{d.package.weight_tier.replace("_", " ")}</span>}
                  {d.cash_to_collect > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700">Collect {xaf(d.cash_to_collect)}</span>}
                </div>
                {d.too_heavy ? (
                  <p className="text-[11px] text-[var(--text-secondary)]">Too heavy for your vehicle.</p>
                ) : (
                  <button type="button" disabled={!!jobs.busy} onClick={() => jobs.claim(d)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--accent)] text-[12px] font-bold text-[var(--accent)] disabled:opacity-50">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Hand className="size-4" />} Take this delivery
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
