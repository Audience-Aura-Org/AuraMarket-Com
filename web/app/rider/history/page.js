"use client";

/**
 * Rider: every finished delivery, newest first, with what was earned and cash
 * collected. Filter by outcome and dates; "Load more" pages by cursor.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, History, CheckCircle2, CircleAlert, Loader2, PackageOpen, XCircle } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import RiderPageHeader, { RIDER_PAGE } from "@/components/rider/RiderPageHeader";

const OUTCOMES = [["", "All"], ["delivered", "Delivered"], ["failed", "Couldn't deliver"], ["cancelled", "Cancelled"]];
const ICON = {
  delivered: <CheckCircle2 className="size-4 text-emerald-600" />,
  failed: <CircleAlert className="size-4 text-amber-600" />,
  cancelled: <XCircle className="size-4 text-[var(--text-secondary)]" />,
};
const LABEL = { delivered: "Delivered", failed: "Couldn't deliver", cancelled: "Cancelled" };
const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;
const FIELD = "min-h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

export default function RiderHistoryPage() {
  const router = useRouter();
  const { user, authChecked, fetchMe } = useAuthStore();
  const [outcome, setOutcome] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { if (!authChecked) fetchMe(); else router.replace("/login?redirect=/rider/history"); }
  }, [user, authChecked, fetchMe, router]);

  const load = useCallback(async (before = null) => {
    setLoading(true);
    try {
      const res = await api.get("/riders/me/history", { params: { ...(outcome && { outcome }), ...(from && { from }), ...(to && { to }), ...(before && { before }) }, skipClientCache: true });
      const data = res.data?.data || { items: [], has_more: false };
      setItems((prev) => (before ? [...prev, ...data.items] : data.items));
      setHasMore(data.has_more);
    } catch { if (!before) setItems([]); }
    finally { setLoading(false); }
  }, [outcome, from, to]);
  useEffect(() => { if (user) load(); }, [user, load]);

  return (
    <div className={RIDER_PAGE}>
      <RiderPageHeader icon={History} title="My deliveries" subtitle="Everything you finished, newest first." />

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Outcome">
        {OUTCOMES.map(([key, label]) => (
          <button key={key || "all"} type="button" role="tab" aria-selected={outcome === key} onClick={() => setOutcome(key)}
            className={`min-h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold ${outcome === key ? "bg-[var(--accent)] text-white" : "border border-[var(--glass-border)] text-[var(--text-secondary)]"}`}>{label}</button>
        ))}
      </div>
      {/* iOS gives date fields a wide minimum width: let them shrink to their column. */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0 space-y-1 text-[11px] text-[var(--text-secondary)]">From<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${FIELD} block w-full min-w-0 max-w-full appearance-none`} /></label>
        <label className="block min-w-0 space-y-1 text-[11px] text-[var(--text-secondary)]">To<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${FIELD} block w-full min-w-0 max-w-full appearance-none`} /></label>
      </div>

      {loading && !items.length ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--glass-border)] px-6 py-12 text-center">
          <PackageOpen className="size-8 text-[var(--text-secondary)] opacity-40" />
          <p className="text-[13px] font-semibold">No deliveries here</p>
          <p className="text-[11px] text-[var(--text-secondary)]">{outcome || from || to ? "Try another filter or dates." : "Finished deliveries will appear here."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--glass-border)] rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          {items.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5">{ICON[d.outcome]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">{d.from || "Pickup"} → {d.to || "Delivery"}</p>
                <p className="text-[10px] tabular-nums text-[var(--text-secondary)]">
                  {LABEL[d.outcome]} · {d.tracking_code} · {new Date(d.completed_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                {d.cash_collected > 0 && <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-700"><Banknote className="size-3" /> Collected {xaf(d.cash_collected)}</p>}
              </div>
              <div className="shrink-0 text-right">
                {d.earned != null && <p className={`text-[12px] font-bold tabular-nums ${d.earned > 0 ? "text-emerald-600" : "text-[var(--text-secondary)]"}`}>+{xaf(d.earned)}</p>}
                {d.delivery_fee != null && <p className="text-[10px] tabular-nums text-[var(--text-secondary)]">Fee {xaf(d.delivery_fee)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button type="button" disabled={loading} onClick={() => load(items[items.length - 1]?.id)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] text-[12px] font-semibold disabled:opacity-50">
          {loading && <Loader2 className="size-4 animate-spin" />} Load more
        </button>
      )}
    </div>
  );
}
