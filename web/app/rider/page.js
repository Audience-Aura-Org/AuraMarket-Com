"use client";

/**
 * Rider → Home: answer an agency's invitation; then go online / offline, work the
 * current delivery, see today at a glance and jump to the map, deliveries,
 * earnings and settings. Offers pop up over every rider tab (app/rider/layout.js).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bike, Building2, Check, History, Loader2, Map as MapIcon, Phone, Power, Settings, Wallet, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import RiderDeliveries from "@/components/rider/RiderDeliveries";
import RiderSummary from "@/components/rider/RiderSummary";
import { refreshRiderProfile } from "@/lib/riderProfile";
import { useRiderJobs } from "@/components/rider/RiderJobsContext";
import RiderPageHeader, { RIDER_PAGE } from "@/components/rider/RiderPageHeader";
import { RiderOffers, RiderOpenDeliveries } from "@/components/rider/RiderBoard";

const QUICK = [
  { href: "/rider/map", label: "Map", sub: "Route & directions", icon: MapIcon },
  { href: "/rider/history", label: "Deliveries", sub: "Everything you did", icon: History },
  { href: "/rider/earnings", label: "Earnings", sub: "Paid & owed", icon: Wallet },
  { href: "/rider/account", label: "Settings", sub: "Alerts, navigation", icon: Settings },
];

const VEHICLE_LABEL = { motorcycle: "Motorcycle", bicycle: "Bicycle", car: "Car", van: "Van", on_foot: "On foot" };

export default function RiderPage() {
  const router = useRouter();
  const { user, hasHydrated, authChecked, fetchMe } = useAuthStore();
  const [rider, setRider] = useState(undefined); // undefined = loading, null = not a rider
  const [busy, setBusy] = useState(false);
  const jobs = useRiderJobs();

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
    try { await fn(); if (success) toast.success(success); await load(); refreshRiderProfile(); jobs?.load(); }
    catch (err) { toast.error(err?.response?.data?.message || "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  if (rider === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-[var(--accent)]" /></div>;
  }

  const shell = (children) => (
    <div className={RIDER_PAGE}>
      <RiderPageHeader icon={Bike} title="Rider" subtitle="Deliveries for your agency" />
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

  const availability = jobs?.data?.availability || rider.availability;
  const online = availability !== "offline";
  const firstName = (user?.name || "").split(" ")[0];
  return (
    <div className={RIDER_PAGE}>
      <RiderPageHeader
        initial={firstName[0]}
        title={`Hi${firstName ? `, ${firstName}` : ""}`}
        subtitle={`${rider.agency?.name || "Your agency"} · ${VEHICLE_LABEL[rider.vehicle_type] || rider.vehicle_type}${rider.vehicle_plate ? ` · ${rider.vehicle_plate}` : ""}`}
        action={rider.agency?.phone && <a href={`tel:${rider.agency?.phone}`} aria-label="Call my agency" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Phone className="size-5" /></a>}
      />

      <button
        type="button"
        role="switch"
        aria-checked={online}
        disabled={busy || availability === "busy"}
        onClick={() => act(() => api.patch("/riders/me/availability", { availability: online ? "offline" : "online" }), online ? "You are offline." : "You are online and can receive deliveries.")}
        className={`flex w-full items-center gap-4 rounded-[28px] p-5 text-left shadow-sm transition-colors disabled:opacity-80 ${availability === "busy" ? "bg-amber-500 text-white" : online ? "bg-emerald-600 text-white" : "border border-[var(--glass-border)] bg-[var(--bg-primary)]"}`}
      >
        <span className={`flex size-14 items-center justify-center rounded-full ${online ? "bg-white/20" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}>{busy ? <Loader2 className="size-6 animate-spin" /> : <Power className="size-6" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold">{availability === "busy" ? "On a delivery" : online ? "You are online" : "You are offline"}</span>
          <span className={`block text-[11px] ${online ? "text-white/85" : "text-[var(--text-secondary)]"}`}>{availability === "busy" ? "You can still accept more deliveries below." : online ? "Tap to stop receiving deliveries." : "Tap to go online and get deliveries."}</span>
        </span>
      </button>

      <RiderOffers />

      <section id="current" className="scroll-mt-20 space-y-2">
        {(jobs?.data?.active?.length || 0) > 1 && <h2 className="text-[13px] font-bold">My deliveries now <span className="font-normal text-[var(--text-secondary)]">({jobs.data.active.length})</span></h2>}
        <RiderDeliveries showRecent={false} />
      </section>

      <RiderOpenDeliveries />

      <RiderSummary refreshKey={availability} compact />

      <nav aria-label="Rider shortcuts" className="grid grid-cols-2 gap-2">
        {QUICK.map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3.5 active:scale-[0.98]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]"><Icon className="size-5" /></span>
            <span className="min-w-0"><span className="block text-[13px] font-semibold">{label}</span><span className="block truncate text-[10px] text-[var(--text-secondary)]">{sub}</span></span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
