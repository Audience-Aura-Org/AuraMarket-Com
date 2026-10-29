"use client";

/**
 * Rider → Account: my agency and vehicle, rider settings kept on this phone
 * (navigation app, new-offer sound and vibration, keep the screen on), location
 * access, and the way back to the shopping side of Auradime.
 */
import { useState } from "react";
import Link from "next/link";
import { Bell, Building2, ChevronRight, LocateFixed, LogOut, Navigation, Phone, ShoppingBag, Smartphone, User, Vibrate } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { useRiderProfile } from "@/lib/riderProfile";
import { useRiderPrefs } from "@/lib/riderPrefs";
import { chime, useRiderJobs } from "@/components/rider/RiderJobsContext";
import { openLocationSettings } from "@/components/rider/useShareLocation";
import RiderPageHeader, { RIDER_PAGE } from "@/components/rider/RiderPageHeader";

const VEHICLE_LABEL = { motorcycle: "Motorcycle", bicycle: "Bicycle", car: "Car", van: "Van", on_foot: "On foot" };
const GPS_TEXT = { sharing: "Location is on and being shared.", denied: "Location access was refused. Riders need it to get nearby deliveries.", unavailable: "This phone could not get a GPS fix.", off: "Shared only while you are online or on a delivery." };

function Toggle({ id, icon: Icon, label, sub, checked, onChange, action }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon className="size-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="block text-[10px] text-[var(--text-secondary)]">{sub}</span>
      </label>
      {action}
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-[var(--glass-border)]"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

export default function RiderAccountPage() {
  const { user, logout } = useAuthStore();
  const rider = useRiderProfile();
  const jobs = useRiderJobs();
  const [prefs, setPrefs] = useRiderPrefs();
  const [stopping, setStopping] = useState(false);
  const availability = jobs?.data?.availability;

  const goOffline = async () => {
    setStopping(true);
    await jobs?.act("offline", () => api.patch("/riders/me/availability", { availability: "offline" }), "You are offline.");
    setStopping(false);
  };

  return (
    <div className={RIDER_PAGE}>
      <RiderPageHeader initial={user?.name?.[0]} title={user?.name || "Rider"} subtitle={user?.email || user?.phone || ""} />

      <section className="flex items-center gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--bg-secondary)]">
          {rider?.agency?.logo ? <img src={rider.agency.logo} alt="" className="size-full object-cover" /> : <Building2 className="size-5 text-[var(--text-secondary)]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[var(--text-secondary)]">My agency</p>
          <p className="truncate text-[13px] font-semibold">{rider?.agency?.name || "Delivery agency"}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{VEHICLE_LABEL[rider?.vehicle_type] || rider?.vehicle_type || ""}{rider?.vehicle_plate ? ` · ${rider.vehicle_plate}` : ""}</p>
        </div>
        {rider?.agency?.phone && <a href={`tel:${rider.agency.phone}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-[var(--glass-border)] px-3 text-[12px] font-semibold"><Phone className="size-4" /> Call</a>}
      </section>

      <section aria-labelledby="nav-app" className="space-y-2.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <p id="nav-app" className="flex items-center gap-2 text-[13px] font-semibold"><Navigation className="size-4 text-[var(--accent)]" /> Directions open in</p>
        <div role="radiogroup" aria-labelledby="nav-app" className="grid grid-cols-2 gap-2">
          {[["google", "Google Maps"], ["waze", "Waze"]].map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={prefs.nav_app === value} onClick={() => setPrefs({ nav_app: value })}
              className={`min-h-11 rounded-2xl border text-[12px] font-semibold ${prefs.nav_app === value ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--glass-border)]"}`}>{label}</button>
          ))}
        </div>
      </section>

      <section aria-label="Alerts and screen" className="divide-y divide-[var(--glass-border)] rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
        <Toggle id="pref-sound" icon={Bell} label="Sound for new offers" sub="A chime when a delivery is offered to you" checked={prefs.offer_sound} onChange={(v) => setPrefs({ offer_sound: v })}
          action={<button type="button" onClick={chime} className="shrink-0 rounded-xl border border-[var(--glass-border)] px-2.5 py-1.5 text-[11px] font-semibold">Test</button>} />
        <Toggle id="pref-vibrate" icon={Vibrate} label="Vibrate for new offers" sub="So you notice offers with the phone in your pocket" checked={prefs.offer_vibrate} onChange={(v) => setPrefs({ offer_vibrate: v })} />
        <Toggle id="pref-awake" icon={Smartphone} label="Keep screen on during deliveries" sub="Directions and steps stay visible while you ride" checked={prefs.keep_awake} onChange={(v) => setPrefs({ keep_awake: v })} />
      </section>

      <section className="space-y-2 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold"><LocateFixed className="size-4 text-[var(--accent)]" /> Location</p>
        <p className={`text-[11px] ${jobs?.gps === "denied" ? "text-amber-700" : "text-[var(--text-secondary)]"}`}>{GPS_TEXT[jobs?.gps || "off"]} It is never shared while you are offline.</p>
        {jobs?.gps === "denied" && openLocationSettings && <button type="button" onClick={openLocationSettings} className="min-h-10 rounded-2xl bg-amber-600 px-4 text-[12px] font-semibold text-white">Open phone settings</button>}
        {availability === "online" && <button type="button" onClick={goOffline} disabled={stopping} className="min-h-10 rounded-2xl border border-[var(--glass-border)] px-4 text-[12px] font-semibold disabled:opacity-50">Go offline now</button>}
      </section>

      <nav aria-label="More" className="divide-y divide-[var(--glass-border)] rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
        {[["/profile", User, "My profile", "Name, phone, password"], ["/shop", ShoppingBag, "Switch to shopping", "Browse and buy on Auradime"]].map(([href, Icon, label, sub]) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5">
            <Icon className="size-5 text-[var(--accent)]" />
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{label}</span><span className="block text-[10px] text-[var(--text-secondary)]">{sub}</span></span>
            <ChevronRight className="size-4 text-[var(--text-secondary)]" />
          </Link>
        ))}
        {logout && (
          <button type="button" onClick={() => logout()} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-rose-600">
            <LogOut className="size-5" /><span className="text-[13px] font-semibold">Sign out</span>
          </button>
        )}
      </nav>
    </div>
  );
}
