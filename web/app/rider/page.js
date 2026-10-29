"use client";

/**
 * Rider workspace: answer an agency's invitation, then go online/offline.
 * Deliveries (accept, pickup, complete) arrive here in the dispatch phase.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Building2, Check, Loader2, Phone, Power, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import RiderDeliveries from "@/components/rider/RiderDeliveries";
import RiderSummary from "@/components/rider/RiderSummary";
import { refreshRiderProfile } from "@/lib/riderProfile";

const VEHICLE_LABEL = { motorcycle: "Motorcycle", bicycle: "Bicycle", car: "Car", van: "Van", on_foot: "On foot" };

export default function RiderPage() {
  const router = useRouter();
  const { user, hasHydrated, authChecked, fetchMe } = useAuthStore();
  const [rider, setRider] = useState(undefined); // undefined = loading, null = not a rider
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) { if (!authChecked) fetchMe(); else router.replace("/login?redirect=/rider"); }
  }, [hasHydrated, authChecked, user, fetchMe, router]);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/riders/me", { skipClientCache: true });
      setRider(res.data?.data?.rider || null);
    } catch {
      setRider(null);
    }
  }, []);
  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);

  const act = async (fn, success) => {
    setBusy(true);
    try { await fn(); if (success) toast.success(success); await load(); refreshRiderProfile(); }
    catch (err) { toast.error(err?.response?.data?.message || "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  if (rider === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-[var(--accent)]" /></div>;
  }

  const shell = (children) => (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 pb-28 text-[var(--text-primary)]">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10"><Bike className="size-5 text-[var(--accent)]" /></div>
        <div><h1 className="text-[16px] font-bold">Rider</h1><p className="text-[10px] text-[var(--text-secondary)]">Deliveries for your agency</p></div>
      </div>
      {children}
    </div>
  );

  if (!rider) {
    return shell(
      <div className="rounded-3xl border border-dashed border-[var(--glass-border)] px-6 py-10 text-center">
        <p className="text-[13px] font-semibold">You are not a rider yet</p>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">A delivery agency on Auradime can invite you with your email address. Their invitation will appear here.</p>
      </div>
    );
  }

  const agencyCard = (
    <div className="flex items-center gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--bg-secondary)]">
        {rider.agency?.logo ? <img src={rider.agency.logo} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-[var(--text-secondary)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[var(--text-secondary)]">My agency</p>
        <p className="truncate text-[13px] font-semibold">{rider.agency?.name || "Delivery agency"}</p>
        <p className="text-[10px] text-[var(--text-secondary)]">{VEHICLE_LABEL[rider.vehicle_type] || rider.vehicle_type}{rider.vehicle_plate ? ` · ${rider.vehicle_plate}` : ""}</p>
      </div>
      {rider.agency?.phone && <a href={`tel:${rider.agency.phone}`} aria-label="Call my agency" className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] hover:text-[var(--accent)]"><Phone className="size-4" /></a>}
    </div>
  );

  if (rider.status === "invited") {
    return shell(<>
      {agencyCard}
      <div className="space-y-3 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
        <p className="text-[13px] font-semibold">{rider.agency?.name || "An agency"} invited you to deliver for them</p>
        <p className="text-[11px] text-[var(--text-secondary)]">If you accept, they can assign you deliveries. Your location is shared only while you are online or on a delivery, never when you are offline.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => act(() => api.post("/riders/me/decline"), "Invitation declined.")} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--glass-border)] text-[12px] font-semibold disabled:opacity-50"><X className="size-4" /> Decline</button>
          <button type="button" disabled={busy} onClick={() => act(() => api.post("/riders/me/accept"), "Welcome to the team!")} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent)] text-[12px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept</button>
        </div>
      </div>
    </>);
  }

  if (rider.status === "inactive") {
    return shell(<>
      {agencyCard}
      <p className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4 text-[11px] text-[var(--text-secondary)]">Your agency has paused your rider account. Contact them to be reactivated.</p>
      <RiderSummary showCash />
    </>);
  }

  const online = rider.availability !== "offline";
  return shell(<>
    {agencyCard}
    <button
      type="button"
      role="switch"
      aria-checked={online}
      disabled={busy || rider.availability === "busy"}
      onClick={() => act(() => api.patch("/riders/me/availability", { availability: online ? "offline" : "online" }), online ? "You are offline." : "You are online and can receive deliveries.")}
      className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left transition-colors disabled:opacity-60 ${online ? "border-emerald-500/40 bg-emerald-500/5" : "border-[var(--glass-border)] bg-[var(--bg-primary)]"}`}
    >
      <span className={`flex size-11 items-center justify-center rounded-2xl ${online ? "bg-emerald-500 text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}>{busy ? <Loader2 className="size-5 animate-spin" /> : <Power className="size-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{rider.availability === "busy" ? "On a delivery" : online ? "You are online" : "You are offline"}</span>
        <span className="block text-[10px] text-[var(--text-secondary)]">{online ? "Tap to stop receiving deliveries." : "Tap to start receiving deliveries."}</span>
      </span>
    </button>
    <RiderDeliveries key={rider.availability} />
    <RiderSummary refreshKey={rider.availability} />
  </>);
}
