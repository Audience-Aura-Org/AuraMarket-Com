"use client";
/**
 * Rider: delivery offers (accept / decline before they expire), the active
 * delivery with navigation, calls and one-tap steps, and recent deliveries.
 */
import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, CircleAlert, Loader2, MapPin, Navigation, PackageOpen, Phone, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";

const NEXT_STEP = {
  assigned: { status: "picked_up", label: "I picked it up" },
  picked_up: { status: "out_for_delivery", label: "I'm on the way" },
  in_transit: { status: "out_for_delivery", label: "I'm on the way" },
};
const STATUS_LABEL = { assigned: "Go to pickup", picked_up: "Picked up", in_transit: "On the way", out_for_delivery: "On the way", delivered: "Delivered", failed: "Failed", cancelled: "Cancelled" };

const secondsLeft = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
const place = (a) => [a?.landmark, a?.street, a?.quartier, a?.city].filter(Boolean).join(", ");
// Google Maps directions to the confirmed pin, or to the written address.
const mapsUrl = (a) => {
  const dest = a?.location?.lat != null ? `${a.location.lat},${a.location.lng}` : place(a);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
};

function Stop({ label, address, contact, phone }) {
  return (
    <div className="flex items-start gap-2.5">
      <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[var(--text-secondary)]">{label}</p>
        <p className="text-[12px] font-semibold">{place(address) || "—"}</p>
        {contact && <p className="text-[10px] text-[var(--text-secondary)]">{contact}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {phone && <a href={`tel:${phone}`} aria-label={`Call ${contact || label}`} className="flex size-9 items-center justify-center rounded-xl border border-[var(--glass-border)]"><Phone className="size-4" /></a>}
        <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" aria-label={`Navigate to ${label}`} className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white"><Navigation className="size-4" /></a>
      </div>
    </div>
  );
}

export default function RiderDeliveries() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [finishing, setFinishing] = useState(null); // { mode: 'delivered' | 'failed' }
  const [form, setForm] = useState({ note: "", cash: "", reason: "" });
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try { const res = await api.get("/riders/me/deliveries", { skipClientCache: true }); setData(res.data.data); } catch { /* keep last view */ }
  }, []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const act = async (key, fn, success) => {
    setBusy(key);
    try { await fn(); if (success) toast.success(success); setFinishing(null); setForm({ note: "", cash: "", reason: "" }); await load(); }
    catch (err) { toast.error(err?.response?.data?.message || "That did not work. Please try again."); await load(); }
    finally { setBusy(null); }
  };
  const step = (s, body, success) => act(`step-${s.id}`, () => api.post(`/riders/me/deliveries/${s.id}/status`, body), success);

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>;

  const offers = data.offers.filter((o) => secondsLeft(o.expires_at) > 0);
  return (
    <div className="space-y-4">
      {offers.map((o) => (
        <div key={o.assignment_id} className="space-y-3 rounded-3xl border-2 border-[var(--accent)]/50 bg-[var(--accent)]/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">New delivery</p>
            <span className="rounded-full bg-[var(--bg-primary)] px-2.5 py-1 text-[11px] font-semibold tabular-nums">{secondsLeft(o.expires_at)} s</span>
          </div>
          <p className="text-[12px]"><span className="font-semibold">{o.shipment.pickup?.quartier}</span> → <span className="font-semibold">{o.shipment.delivery?.quartier}</span></p>
          <p className="text-[10px] text-[var(--text-secondary)]">{o.shipment.tracking_code} · {o.shipment.package?.description || o.shipment.package?.category} · {o.shipment.package?.weight_tier}</p>
          {o.shipment.cash_to_collect > 0 && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600"><Banknote className="size-4" /> Collect {Number(o.shipment.cash_to_collect).toLocaleString()} XAF on delivery</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => act(`rej-${o.assignment_id}`, () => api.post(`/riders/me/offers/${o.assignment_id}/reject`), "Offer declined.")} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[12px] font-semibold disabled:opacity-50"><X className="size-4" /> Decline</button>
            <button type="button" disabled={!!busy} onClick={() => act(`acc-${o.assignment_id}`, () => api.post(`/riders/me/offers/${o.assignment_id}/accept`), "Delivery accepted. Head to the pickup.")} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent)] text-[12px] font-semibold text-white disabled:opacity-50">{busy === `acc-${o.assignment_id}` ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept</button>
          </div>
        </div>
      ))}

      {data.active.map(({ assignment_id, shipment: s }) => {
        const next = NEXT_STEP[s.status];
        return (
          <div key={assignment_id} className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold">{STATUS_LABEL[s.status] || s.status}</p>
              <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">{s.tracking_code}</span>
            </div>
            <Stop label="Pickup" address={s.pickup} contact={s.pickup?.contact} phone={s.pickup?.phone} />
            <Stop label="Delivery" address={s.delivery} contact={s.delivery?.contact} phone={s.delivery?.phone} />
            {s.instructions && <p className="rounded-xl bg-[var(--bg-secondary)] px-3 py-2 text-[11px]">{s.instructions}</p>}
            {s.cash_to_collect > 0 && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600"><Banknote className="size-4" /> Collect {Number(s.cash_to_collect).toLocaleString()} XAF</p>}

            {finishing?.id === s.id ? (
              <div className="space-y-2 rounded-2xl bg-[var(--bg-secondary)] p-3">
                {finishing.mode === "delivered" ? (
                  <>
                    <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Who received it? e.g. Handed to Jean" aria-label="Delivery note" className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[13px] outline-none" />
                    {s.cash_to_collect > 0 && <input inputMode="numeric" value={form.cash} onChange={(e) => setForm((f) => ({ ...f, cash: e.target.value.replace(/\D/g, "") }))} placeholder={`Cash collected (XAF), due ${Number(s.cash_to_collect).toLocaleString()}`} aria-label="Cash collected" className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[13px] tabular-nums outline-none" />}
                    <button type="button" disabled={!!busy || !form.note.trim() || (s.cash_to_collect > 0 && form.cash === "")} onClick={() => step(s, { status: "delivered", note: form.note.trim(), receiver_name: form.note.trim(), ...(s.cash_to_collect > 0 ? { cash_collected: Number(form.cash) } : {}) }, "Delivered. Well done!")} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm delivery</button>
                  </>
                ) : (
                  <>
                    <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Why? e.g. Recipient not reachable" aria-label="Failure reason" className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[13px] outline-none" />
                    <button type="button" disabled={!!busy || !form.reason.trim()} onClick={() => step(s, { status: "failed", failure_reason: form.reason.trim() }, "Reported. Your agency has been told.")} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-rose-600 text-[12px] font-semibold text-white disabled:opacity-50"><CircleAlert className="size-4" /> Report failed delivery</button>
                  </>
                )}
                <button type="button" onClick={() => setFinishing(null)} className="w-full text-[11px] font-semibold text-[var(--text-secondary)]">Back</button>
              </div>
            ) : (
              <div className="grid gap-2">
                {next ? (
                  <button type="button" disabled={!!busy} onClick={() => step(s, { status: next.status }, null)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent)] text-[13px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{next.label}</button>
                ) : (
                  <button type="button" onClick={() => setFinishing({ id: s.id, mode: "delivered" })} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 text-[13px] font-semibold text-white"><Check className="size-4" /> Delivered</button>
                )}
                {s.status !== "assigned" && <button type="button" onClick={() => setFinishing({ id: s.id, mode: "failed" })} className="min-h-10 rounded-2xl border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)]">Couldn’t deliver</button>}
              </div>
            )}
          </div>
        );
      })}

      {!offers.length && !data.active.length && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--glass-border)] px-6 py-10 text-center">
          <PackageOpen className="size-8 text-[var(--text-secondary)] opacity-40" />
          <p className="text-[13px] font-semibold">No deliveries right now</p>
          <p className="max-w-xs text-[11px] text-[var(--text-secondary)]">{data.availability === "offline" ? "Go online to receive delivery offers." : "New offers from your agency appear here."}</p>
        </div>
      )}

      {data.recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold">Recent</p>
          <ul className="divide-y divide-[var(--glass-border)] rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
            {data.recent.map((r) => (
              <li key={r.assignment_id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-[12px] font-semibold">{r.shipment?.delivery?.quartier || "Delivery"}</p><p className="text-[10px] tabular-nums text-[var(--text-secondary)]">{r.shipment?.tracking_code}{r.completed_at ? ` · ${new Date(r.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}</p></div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}>{r.status === "completed" ? "Delivered" : "Cancelled"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
