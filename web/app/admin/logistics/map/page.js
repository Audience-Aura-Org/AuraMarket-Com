"use client";

/**
 * Admin: live map of online riders and deliveries under way, refreshed every
 * 20 s while the tab is visible (GET /admin/logistics/live-map).
 */
import { useCallback, useEffect, useState } from "react";
import withMapFallback from "@/components/location/withMapFallback";
import { Bike, Loader2, MapPinned, Package, RefreshCw, Timer } from "lucide-react";
import api from "@/services/api";
import StatCard from "@/components/layout/StatCard";

// Google Maps when a key is configured, else the free MapLibre map.
const FleetMap = withMapFallback(() => import("@/components/location/google/GoogleFleetMap"), () => import("@/components/location/FleetMap"),
  () => <div className="flex h-[60vh] min-h-[360px] items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>);

const REFRESH_MS = 20000;
const LEGEND = [
  { color: "#2563eb", label: "Free rider" },
  { color: "#d97706", label: "Rider on a delivery" },
  { color: "#111827", label: "Pickup" },
  { color: "#ff00ff", label: "Drop-off" },
];

export default function AdminLiveMapPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/logistics/live-map", { skipClientCache: true });
      setData(res.data?.data || null);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load the live map.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const riders = data?.riders || [];
  const deliveries = data?.deliveries || [];
  const waiting = deliveries.filter((d) => !d.has_rider).length;

  return (
    <div className="w-full space-y-4 px-3 py-5 text-[var(--text-primary)] sm:px-4 lg:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[18px] font-bold"><MapPinned className="size-5 text-[var(--accent)]" /> Live map</h1>
          <p className="text-[11px] text-[var(--text-secondary)]">Online riders and deliveries under way. Hollow markers sit at the quartier centre because no exact pin was given.</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)]">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Riders online" value={riders.length} icon={Bike} />
        <StatCard label="On a delivery" value={riders.filter((r) => r.availability === "busy").length} icon={Bike} />
        <StatCard label="Deliveries under way" value={deliveries.length} icon={Package} />
        <StatCard label="Waiting for a rider" value={waiting} icon={Timer} />
      </div>

      {error && <p className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-[11px]">{error}</p>}

      {/* Full width, and as tall as the screen allows. */}
      <FleetMap riders={riders} deliveries={deliveries} height="h-[calc(100dvh-220px)] min-h-[480px]" />

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--text-secondary)]">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-white shadow" style={{ background: l.color }} />{l.label}</span>
        ))}
        {data?.generated_at && <span className="ml-auto tabular-nums">Updated {new Date(data.generated_at).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
