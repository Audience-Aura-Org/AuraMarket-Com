"use client";
/**
 * Agency: offer a delivery to one of its riders, see the live offer / rider,
 * the dispatch engine's suggestion (shadow mode), and cancel before pickup.
 */
import { useCallback, useEffect, useState } from "react";
import { Bike, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useFeatureFlag } from "@/lib/featureFlags";

const ENDED = ["delivered", "cancelled"];
const AVAIL = { online: "Online", busy: "On a delivery", offline: "Offline" };

const secondsLeft = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));

export default function AssignRiderPanel({ shipment, onChanged }) {
  const enabled = useFeatureFlag("rider_accounts");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    if (!shipment?._id) return;
    try {
      const res = await api.get(`/logistics/shipments/${shipment._id}/assignment`, { skipClientCache: true });
      setData(res.data.data);
    } catch { setData(null); }
  }, [shipment?._id]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  // Keep the countdown and the offer state fresh while an offer is open.
  useEffect(() => {
    if (data?.live?.status !== "offered") return undefined;
    const t = setInterval(() => { tick((n) => n + 1); if (secondsLeft(data.live.expires_at) === 0) load(); }, 1000);
    const poll = setInterval(load, 10000);
    return () => { clearInterval(t); clearInterval(poll); };
  }, [data?.live, load]);

  if (!enabled || !shipment?._id || !data || ENDED.includes(shipment.status)) return null;

  const act = async (fn, msg) => {
    setBusy(msg);
    try { await fn(); toast.success(msg); await load(); onChanged?.(); }
    catch (err) { toast.error(err?.response?.data?.message || "That did not work. Please try again."); }
    finally { setBusy(null); }
  };
  const offer = (r) => act(() => api.post(`/logistics/shipments/${shipment._id}/assign`, { rider_id: r.id }), `Offered to ${r.name}.`);
  const cancel = () => act(() => api.post(`/logistics/shipments/${shipment._id}/assignment/cancel`), "Rider offer cancelled.");
  const liveName = data.live?.rider_id?.name || "the rider";
  const suggested = data.suggested && data.riders.find((r) => String(r.user_id) === String(data.suggested.rider_id));

  return (
    <div className="mx-4 mt-3 space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 md:mx-8">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]"><Bike className="size-4 text-[var(--accent)]" /> Rider</p>

      {data.live ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{data.live.status === "accepted" ? `${liveName} is carrying this delivery` : `Waiting for ${liveName} to accept`}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{data.live.status === "offered" ? `Offer expires in ${secondsLeft(data.live.expires_at)} s` : `Accepted ${new Date(data.live.responded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}{data.live.mode === "auto" ? " · chosen automatically" : ""}</p>
          </div>
          <button type="button" onClick={cancel} disabled={!!busy} aria-label="Cancel rider offer" className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-rose-600 disabled:opacity-50"><X className="size-4" /></button>
        </div>
      ) : (
        <>
          {suggested && (
            <p className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2 text-[11px]">
              <Sparkles className="size-3.5 shrink-0 text-[var(--accent)]" /> Suggested: <span className="font-semibold">{suggested.name}</span> · {data.suggested.reason}
            </p>
          )}
          {data.riders.length === 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)]">You have no active riders yet. Invite them from the Riders page.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.riders.map((r) => (
                <li key={r.id} className={`flex items-center gap-3 rounded-xl border border-[var(--glass-border)] p-2.5 ${r.eligible ? "" : "opacity-50"}`}>
                  <span className={`size-2 shrink-0 rounded-full ${r.availability === "online" ? "bg-emerald-500" : r.availability === "busy" ? "bg-amber-500" : "bg-slate-400"}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{r.rank ? `${r.rank}. ` : ""}{r.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{AVAIL[r.availability] || r.availability}{r.reason ? ` · ${r.reason}` : ""}</p>
                  </div>
                  <button type="button" disabled={!!busy || r.availability === "busy"} onClick={() => offer(r)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-[var(--accent)] px-3 text-[11px] font-semibold text-white disabled:opacity-40">
                    {busy === `Offered to ${r.name}.` ? <Loader2 className="size-3.5 animate-spin" /> : "Offer"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
