"use client";
/**
 * Admin: how one delivery is mapped out (GET /admin/logistics/shipments/:id/plan).
 * Pickup and drop-off are exact spots (place search, map pin, GPS or a saved
 * address) or, without one, the quartier centre. The road route between them gives
 * the km and minutes. Distance-priced agencies charge base + per km on that road
 * distance; others use their quartier price list; agencies may also type a fee.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Bike, CircleDot, Loader2, MapPin, Receipt, Route } from "lucide-react";
import api from "@/services/api";

const RiderMap = dynamic(() => import("@/components/location/RiderMap"), {
  ssr: false,
  loading: () => <div className="flex size-full items-center justify-center text-[11px] text-[var(--text-secondary)]">Loading map…</div>,
});

const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;
const FEE_BASIS = {
  distance: "Distance pricing: road km from pickup to drop-off",
  district: "Quartier price list of the agency",
  manual: "Typed in by the agency",
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
        <div className="text-[12px]">{children}</div>
      </div>
    </div>
  );
}

const Spot = ({ s }) => s ? (
  <>
    <p className="font-semibold">{s.label || "—"}</p>
    <p className={`text-[11px] ${s.exact ? "text-emerald-600" : "text-amber-600"}`}>{s.exact ? `Exact spot · ${s.how}` : s.how}</p>
  </>
) : <p className="text-[11px] text-rose-600">Not on the map: no spot and no known quartier.</p>;

export default function ShipmentPlan({ shipmentId }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shipmentId) return;
    setPlan(null); setError("");
    api.get(`/admin/logistics/shipments/${shipmentId}/plan`, { skipClientCache: true })
      .then((res) => setPlan(res.data?.data || null))
      .catch((err) => setError(err?.response?.data?.message || "Could not load how this delivery is mapped."));
  }, [shipmentId]);

  if (error) return <p className="rounded-2xl bg-rose-500/5 p-3 text-[11px] text-rose-600">{error}</p>;
  if (!plan) return <div className="flex h-24 items-center justify-center"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>;

  const job = plan.pickup || plan.dropoff ? { shipment_id: shipmentId, status: "assigned", pickup: plan.pickup, dropoff: plan.dropoff && { ...plan.dropoff, approx: !plan.dropoff.exact }, route: plan.road && { coordinates: plan.road.coordinates, computed_at: shipmentId } } : null;
  if (job?.pickup) job.pickup = { ...job.pickup, approx: !plan.pickup.exact };
  const r = plan.fee.rates;

  return (
    <section aria-label="How this delivery is mapped" className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-3 sm:p-4">
      <p className="text-[12px] font-bold">How this delivery is mapped</p>
      {job && <div className="h-56 overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64"><RiderMap me={null} job={job} padding={36} /></div>}
      <div className="divide-y divide-[var(--glass-border)]">
        <Row icon={CircleDot} label="Pickup"><Spot s={plan.pickup} /></Row>
        <Row icon={MapPin} label="Drop-off"><Spot s={plan.dropoff} /></Row>
        <Row icon={Route} label="Road">
          {plan.road
            ? <p><span className="font-semibold tabular-nums">{plan.road.approx ? "about " : ""}{plan.road.distance_km} km</span>{plan.road.minutes ? ` · ${plan.road.minutes} min` : ""}{plan.road.approx ? <span className="text-[11px] text-[var(--text-secondary)]"> (straight line × 1.3, routing unavailable)</span> : null}</p>
            : <p className="text-[11px] text-[var(--text-secondary)]">Needs both stops on the map.</p>}
          {plan.cities.from && <p className="text-[11px] text-[var(--text-secondary)]">{plan.cities.cross_city ? `Cross-city: ${plan.cities.from} → ${plan.cities.to}` : `Within ${plan.cities.to || plan.cities.from}`}</p>}
        </Row>
        <Row icon={Receipt} label="Fee">
          <p><span className="font-semibold tabular-nums">{xaf(plan.fee.price)}</span>{plan.fee.charged != null && plan.fee.charged !== plan.fee.price ? <span className="text-[11px] text-[var(--text-secondary)]"> · customer charged {xaf(plan.fee.charged)}</span> : null}</p>
          <p className="text-[11px] text-[var(--text-secondary)]">{FEE_BASIS[plan.fee.source] || plan.fee.source}{plan.fee.agency ? ` · ${plan.fee.agency}` : ""}</p>
          {r && <p className="text-[11px] text-[var(--text-secondary)]">Rates now: {xaf(r.base_fee)} + {xaf(r.per_km)}/km, min {xaf(r.min_fee)}{r.max_fee > 0 ? `, max ${xaf(r.max_fee)}` : ""}</p>}
        </Row>
        <Row icon={Bike} label="Rider">
          {plan.rider
            ? <p><span className="font-semibold">{plan.rider.name}</span>{plan.rider.vehicle_type ? ` · ${plan.rider.vehicle_type.replace("_", " ")}` : ""}{plan.rider.vehicle_plate ? ` · ${plan.rider.vehicle_plate}` : ""}{plan.rider.phone ? <> · <a href={`tel:${plan.rider.phone}`} className="text-[var(--accent)]">{plan.rider.phone}</a></> : null}</p>
            : plan.offer?.status === "offered"
              ? <p>Offered to <span className="font-semibold">{plan.offer.rider}</span> ({plan.offer.mode === "auto" ? "automatic" : "by the agency"}), waiting for an answer</p>
              : <p className="text-[11px] text-[var(--text-secondary)]">No rider yet{plan.offer ? ` · last offer ${plan.offer.status}` : ""}</p>}
        </Row>
      </div>
    </section>
  );
}
