"use client";

/**
 * Agency: Manage Riders — invite riders by email, see who is online, and
 * activate or deactivate them, and record the cash riders hand over after
 * pay-on-delivery jobs. Only this agency's riders are ever listed.
 */
import { useCallback, useEffect, useState } from "react";
import { Banknote, Bike, HandCoins, Loader2, Mail, Phone, Plus, Power, RefreshCw, UserCheck, Users, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import StatCard from "@/components/layout/StatCard";
import { LogisticsSubpageHeader } from "@/components/logistics/LogisticsSubpageShell";
import { useFeatureFlag } from "@/lib/featureFlags";
import RiderPayRate from "@/components/logistics/RiderPayRate";
import RiderLimit from "@/components/logistics/RiderLimit";

const VEHICLES = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "on_foot", label: "On foot" },
];
const STATUS_STYLE = {
  active: "bg-emerald-500/10 text-emerald-600",
  invited: "bg-amber-500/10 text-amber-600",
  inactive: "bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
};
const FIELD = "min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[12px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]";
const EMPTY_FORM = { name: "", email: "", phone: "", vehicle_type: "motorcycle", vehicle_plate: "" };

const lastSeen = (iso) => {
  if (!iso) return "never online";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export default function LogisticsRidersPage() {
  const [riders, setRiders] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Money form under a rider: cash they handed over, or pay the agency gave them.
  const [handover, setHandover] = useState(null); // { id, kind: 'cash' | 'pay', amount, note }
  const ridersEnabled = useFeatureFlag("rider_accounts");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/logistics/riders", { skipClientCache: true });
      setRiders(res.data?.data?.riders || []);
      setCounts(res.data?.data?.counts || {});
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not load your riders.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/logistics/riders/invite", form);
      toast.success(`Invitation sent to ${form.email}.`);
      setForm(EMPTY_FORM);
      setShowInvite(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not send the invitation.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (rider, status) => {
    setBusyId(rider.id);
    try {
      await api.patch(`/logistics/riders/${rider.id}`, { status });
      toast.success(status === "inactive" ? `${rider.user?.name || "Rider"} was deactivated.` : `${rider.user?.name || "Rider"} is active again.`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not update this rider.");
    } finally {
      setBusyId(null);
    }
  };

  const recordHandover = async (e) => {
    e.preventDefault();
    const rider = riders.find((x) => x.id === handover.id);
    setBusyId(handover.id);
    try {
      const pay = handover.kind === "pay";
      await api.post(`/logistics/riders/${handover.id}/${pay ? "payouts" : "cash-handovers"}`, { amount: Number(handover.amount), note: handover.note });
      toast.success(pay ? `Recorded paying ${rider?.user?.name || "the rider"} ${Number(handover.amount).toLocaleString()} XAF.` : `Recorded ${Number(handover.amount).toLocaleString()} XAF from ${rider?.user?.name || "the rider"}.`);
      setHandover(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not record the handover.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(7rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-16">
      <LogisticsSubpageHeader
        Icon={Bike}
        title="Manage"
        accentTitle="riders"
        tag="Your delivery team"
        hint="Invite riders by email. They sign in with a code and accept from their Rider page."
        actions={
          <>
            <button type="button" onClick={load} aria-label="Refresh" className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--accent)]">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" disabled={!ridersEnabled} onClick={() => setShowInvite((v) => !v)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[12px] font-semibold text-white disabled:opacity-40">
              {showInvite ? <X className="size-4" /> : <Plus className="size-4" />} {showInvite ? "Close" : "Invite rider"}
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[1100px] space-y-5 px-3 py-5 sm:px-5 md:px-8">
        {!ridersEnabled && (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[11px] text-[var(--text-primary)]">Rider accounts are not switched on for your platform yet. You will be able to invite riders as soon as they are.</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Active riders" value={counts.active || 0} icon={UserCheck} />
          <StatCard label="Online now" value={counts.online || 0} icon={Power} />
          <StatCard label="Invites waiting" value={counts.invited || 0} icon={Mail} />
          <StatCard label="Cash with riders" value={`${(counts.cash_holding || 0).toLocaleString()} XAF`} icon={Banknote} />
          <StatCard label="Pay owed to riders" value={`${(counts.pay_owed || 0).toLocaleString()} XAF`} icon={HandCoins} />
        </div>

        {ridersEnabled && <RiderPayRate />}
        {ridersEnabled && <RiderLimit />}

        {showInvite && (
          <form onSubmit={submitInvite} className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5">
            <p className="text-[12px] font-semibold">Invite a rider</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" aria-label="Full name" className={FIELD} />
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email (they sign in with it)" aria-label="Email" className={FIELD} />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone, e.g. 677 12 34 56" aria-label="Phone" className={FIELD} />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.vehicle_type} onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))} aria-label="Vehicle" className={FIELD}>
                  {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
                <input value={form.vehicle_plate} onChange={(e) => setForm((f) => ({ ...f, vehicle_plate: e.target.value }))} placeholder="Plate (optional)" aria-label="Plate" className={`${FIELD} uppercase`} />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-[12px] font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send invitation
              </button>
            </div>
          </form>
        )}

        {loading && !riders.length ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />)}</div>
        ) : riders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--glass-border)] px-6 py-12 text-center">
            <Users className="size-8 text-[var(--text-secondary)] opacity-40" />
            <p className="text-[13px] font-semibold">No riders yet</p>
            <p className="max-w-sm text-[11px] text-[var(--text-secondary)]">Invite the people who deliver for you. Once they accept, you can assign them deliveries and follow them on the map.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {riders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 sm:flex-nowrap sm:p-4">
                <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-secondary)] text-[13px] font-semibold">
                  {r.user?.avatar ? <img src={r.user.avatar} alt="" className="size-full object-cover" /> : (r.user?.name || "?")[0].toUpperCase()}
                  {r.status === "active" && <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--bg-primary)] ${r.availability === "offline" ? "bg-slate-400" : r.availability === "busy" ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[12px] font-semibold">{r.user?.name || "Rider"}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[r.status] || ""}`}>{r.status === "invited" ? "Invite sent" : r.status}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-secondary)]">
                    <span className="text-[10px]">{VEHICLES.find((v) => v.value === r.vehicle_type)?.label || r.vehicle_type}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ""}</span>
                    {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-[10px] hover:text-[var(--accent)]"><Phone className="size-3" />{r.phone}</a>}
                    {r.status === "active" && <span className="text-[10px]">{r.availability === "offline" ? `Offline · seen ${lastSeen(r.last_seen_at)}` : r.availability === "busy" ? "On a delivery" : "Online"}</span>}
                    {r.status === "invited" && <span className="text-[10px]">{r.user?.email}</span>}
                    {r.cash?.holding > 0 && <span className="text-[10px] font-semibold text-amber-600">Holding {r.cash.holding.toLocaleString()} XAF cash</span>}
                    {r.pay?.owed > 0 && <span className="text-[10px] font-semibold text-emerald-600">You owe {r.pay.owed.toLocaleString()} XAF pay</span>}
                  </p>
                </div>
                {r.pay?.owed > 0 && handover?.id !== r.id && (
                  <button type="button" onClick={() => setHandover({ id: r.id, kind: "pay", amount: String(r.pay.owed), note: "" })} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 text-[11px] font-semibold text-emerald-600">
                    <HandCoins className="size-3.5" /> Pay rider
                  </button>
                )}
                {r.cash?.holding > 0 && handover?.id !== r.id && (
                  <button type="button" onClick={() => setHandover({ id: r.id, kind: "cash", amount: String(r.cash.holding), note: "" })} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/40 px-3 text-[11px] font-semibold text-amber-600">
                    <Banknote className="size-3.5" /> Cash received
                  </button>
                )}
                {(r.status === "active" || r.status === "inactive") && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r, r.status === "active" ? "inactive" : "active")}
                    className={`min-h-9 shrink-0 rounded-xl border px-3 text-[11px] font-semibold disabled:opacity-50 ${r.status === "active" ? "border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-rose-400 hover:text-rose-600" : "border-[var(--accent)]/40 text-[var(--accent)]"}`}
                  >
                    {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : r.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                )}
                {handover?.id === r.id && (
                  <form onSubmit={recordHandover} className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg-secondary)] p-2.5">
                    <input required inputMode="numeric" value={handover.amount} onChange={(e) => setHandover((h) => ({ ...h, amount: e.target.value.replace(/[^0-9]/g, "") }))} aria-label={handover.kind === "pay" ? "Amount paid (XAF)" : "Amount received (XAF)"} placeholder="Amount (XAF)" className={`${FIELD} w-36 flex-none bg-[var(--bg-primary)] tabular-nums`} />
                    <input value={handover.note} onChange={(e) => setHandover((h) => ({ ...h, note: e.target.value }))} aria-label="Note" placeholder="Note (optional)" className={`${FIELD} min-w-0 flex-1 bg-[var(--bg-primary)]`} />
                    <button type="submit" disabled={busyId === r.id || !Number(handover.amount)} className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-[var(--accent)] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{busyId === r.id ? <Loader2 className="size-4 animate-spin" /> : null}Record</button>
                    <button type="button" onClick={() => setHandover(null)} aria-label="Cancel" className="flex size-11 items-center justify-center rounded-2xl text-[var(--text-secondary)]"><X className="size-4" /></button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
