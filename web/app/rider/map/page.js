"use client";

/**
 * Rider → Map: full-screen map of the rider and the delivery they are on, with the
 * road route, time and distance to the next stop, and the next step one tap away.
 * Directions open in the rider's chosen navigation app (Account → Settings).
 */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Crosshair, Loader2, Navigation, Phone, Power } from "lucide-react";
import api from "@/services/api";
import { useRiderJobs } from "@/components/rider/RiderJobsContext";
import { directionsUrl } from "@/lib/riderPrefs";

const RiderMap = dynamic(() => import("@/components/location/RiderMap"), {
  ssr: false,
  loading: () => <div className="flex size-full items-center justify-center bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)]">Loading map…</div>,
});

const NEXT_STEP = {
  assigned: { status: "picked_up", label: "I picked it up" },
  picked_up: { status: "out_for_delivery", label: "I'm on the way" },
  in_transit: { status: "out_for_delivery", label: "I'm on the way" },
};
const place = (a) => [a?.landmark, a?.street, a?.quartier, a?.city].filter(Boolean).join(", ");

export default function RiderMapPage() {
  const jobs = useRiderJobs();
  const [map, setMap] = useState(null);
  const [recenter, setRecenter] = useState(0);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try { const res = await api.get("/riders/me/map", { skipClientCache: true }); setMap(res.data?.data || null); } catch { /* keep last */ }
  }, []);
  const activeKey = (jobs?.data?.active || []).map((a) => `${a.shipment.id}:${a.shipment.status}`).join(",");
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load, activeKey]);

  const job = map?.jobs?.[0] || null;
  const card = jobs?.data?.active?.find((a) => String(a.shipment.id) === String(job?.shipment_id))?.shipment || null;
  const me = jobs?.position || map?.me || null;
  const availability = jobs?.data?.availability || map?.availability;
  const toPickup = job?.status === "assigned";
  const stop = card ? (toPickup ? card.pickup : card.delivery) : null;
  const point = job ? (toPickup ? job.pickup : job.dropoff) : null;
  const eta = job?.route ? (toPickup ? job.route.pickup_eta_min : job.route.dropoff_eta_min) : null;
  const next = card && NEXT_STEP[card.status];

  const goOnline = async () => {
    setToggling(true);
    await jobs.act("online", () => api.patch("/riders/me/availability", { availability: "online" }), "You are online and can receive deliveries.");
    setToggling(false);
    load();
  };

  return (
    // Fills the screen between the top bar and the bottom nav.
    <div className="fixed inset-x-0 bottom-0 top-[var(--top-nav-height,calc(56px+env(safe-area-inset-top,0px)))] z-[40] overflow-hidden md:top-[var(--top-nav-height-lg,calc(60px+env(safe-area-inset-top,0px)))]">
      <RiderMap me={me} vehicle={map?.vehicle_type} job={job} recenterKey={recenter} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className={`pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold shadow-md ${availability === "busy" ? "bg-amber-500 text-white" : availability === "online" ? "bg-emerald-600 text-white" : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"}`}>
          <span className="size-2 rounded-full bg-current opacity-80" /> {availability === "busy" ? "On a delivery" : availability === "online" ? "Online" : "Offline"}
        </span>
        <button type="button" onClick={() => setRecenter((n) => n + 1)} disabled={!me} aria-label="Centre the map on me" className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--accent)] shadow-md disabled:opacity-40"><Crosshair className="size-5" /></button>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3 pb-[calc(68px+env(safe-area-inset-bottom,0px)+0.75rem)] sm:pb-28">
        <div className="mx-auto max-w-lg space-y-3 rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-xl">
          {job && card ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{toPickup ? "Go to pickup" : "Deliver to"}</p>
                  <p className="truncate text-[15px] font-bold">{place(stop) || point?.quartier || "—"}</p>
                  {stop?.contact && <p className="truncate text-[11px] text-[var(--text-secondary)]">{stop.contact}</p>}
                </div>
                {eta != null && (
                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-bold leading-none tabular-nums">{eta}<span className="ml-0.5 text-[11px] font-semibold">min</span></p>
                    <p className="mt-1 text-[10px] tabular-nums text-[var(--text-secondary)]">{job.route.distance_km} km{point?.approx ? " · area" : ""}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                {stop?.phone
                  ? <a href={`tel:${stop.phone}`} aria-label={`Call ${stop.contact || "this stop"}`} className="flex size-12 items-center justify-center rounded-2xl border border-[var(--glass-border)]"><Phone className="size-5" /></a>
                  : <span className="size-12" />}
                <a href={directionsUrl(jobs.prefs?.nav_app, stop?.location || point, place(stop))} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[13px] font-semibold text-white"><Navigation className="size-4" /> Navigate{jobs.prefs?.nav_app === "waze" ? " with Waze" : ""}</a>
              </div>
              {next ? (
                <button type="button" disabled={!!jobs.busy} onClick={() => jobs.step(card, { status: next.status }, null).then(load)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600 text-[13px] font-bold text-emerald-700 disabled:opacity-50">
                  {jobs.busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {next.label}
                </button>
              ) : (
                <Link href="/rider#current" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[13px] font-bold text-white"><Check className="size-4" /> Finish delivery</Link>
              )}
            </>
          ) : availability === "offline" ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1"><p className="text-[14px] font-bold">You are offline</p><p className="text-[11px] text-[var(--text-secondary)]">Go online to get deliveries near you.</p></div>
              <button type="button" onClick={goOnline} disabled={toggling} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-[13px] font-bold text-white disabled:opacity-50">{toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />} Go online</button>
            </div>
          ) : (
            <div>
              <p className="text-[14px] font-bold">Waiting for deliveries</p>
              <p className="text-[11px] text-[var(--text-secondary)]">Offers pop up with a sound. Staying near busy areas gets you offers sooner.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
