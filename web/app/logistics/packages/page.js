"use client";

/**
 * Agency: register a package that is not a marketplace order, then share its
 * secure tracking link (WhatsApp share opens wa.me — no paid WhatsApp API).
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, MessageCircle, Package, PackagePlus, Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import AddressField from "@/components/location/AddressField";
import { LogisticsSubpageHeader } from "@/components/logistics/LogisticsSubpageShell";
import { useFeatureFlag } from "@/lib/featureFlags";
import AssignRiderPanel from "@/components/logistics/AssignRiderPanel";

// 16px text on phones (iOS zooms into smaller fields), 13px from tablet up.
const FIELD = "min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[13px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] sm:text-[13px]";
const LABEL = "mb-1.5 block text-[12px] font-medium text-[var(--text-primary)]";
const CARD = "space-y-3.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5";

function StepTitle({ n, id, children }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-[14px] font-semibold">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white" aria-hidden="true">{n}</span>
      {children}
    </h2>
  );
}

/** One-tap choices instead of a dropdown (faster on phones). */
function Chips({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className={LABEL}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`min-h-10 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${value === v ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}
const CATEGORIES = [["document", "Documents"], ["clothing", "Clothing"], ["electronics", "Electronics"], ["food", "Food"], ["fragile", "Fragile"], ["household", "Household"], ["other", "Other"]];
const WEIGHTS = [["light", "Light (under 5 kg)"], ["medium", "Medium (5–15 kg)"], ["heavy", "Heavy (15–30 kg)"], ["extra_heavy", "Extra heavy (30 kg+)"]];
const EMPTY = {
  reference: "", description: "", category: "other", weight_tier: "light", handling_instructions: "",
  sender: { name: "", phone: "" }, recipient: { name: "", phone: "" },
  pickup: {}, delivery: {}, fee: "", payer: "sender", payment_arrangement: "paid_to_agency",
};

export default function AgencyPackagesPage() {
  const enabled = useFeatureFlag("agency_packages");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (path, value) => setForm((f) => {
    const [a, b] = path.split(".");
    return b ? { ...f, [a]: { ...f[a], [b]: value } } : { ...f, [a]: value };
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.pickup.zone_id || !form.delivery.zone_id) { toast.error("Choose the pickup and delivery quartiers."); return; }
    setSaving(true);
    try {
      const res = await api.post("/logistics/packages", form);
      setCreated(res.data.data);
      toast.success("Package registered.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not register the package.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); toast.success("Link copied."); } catch { toast.error("Copy failed — select the link instead."); }
  };

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(7rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-16">
      <LogisticsSubpageHeader Icon={PackagePlus} title="Add" accentTitle="package" tag="Your own deliveries" hint="Register a package you are delivering, then share its tracking link with the recipient on WhatsApp." />

      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-3 py-5 sm:px-5 md:px-8">
        {!enabled && <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[11px]">Package registration is not switched on for your platform yet.</p>}

        {created ? (
          <div className={CARD}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><Check className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Package registered</p>
                <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">{created.shipment.tracking_code}{created.shipment.agency_package?.reference ? ` · ${created.shipment.agency_package.reference}` : ""} · {Number(created.shipment.price).toLocaleString()} XAF</p>
              </div>
            </div>
            <div>
              <p className={LABEL}>Tracking link</p>
              <div className="flex gap-2">
                <input readOnly value={created.tracking_link} aria-label="Tracking link" className={`${FIELD} text-[12px]`} onFocus={(e) => e.target.select()} />
                <button type="button" onClick={() => copy(created.tracking_link)} aria-label="Copy link" className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--glass-border)] hover:text-[var(--accent)]"><Copy className="size-4" /></button>
              </div>
              <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">Anyone with this link sees the delivery’s progress. It stops working 3 days after delivery.</p>
            </div>
            {/* Hand it to a rider right away (automatic dispatch may already have offered it). */}
            <AssignRiderPanel shipment={created.shipment} inline />
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={created.whatsapp_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#128C7E] text-[12px] font-semibold text-white"><MessageCircle className="size-4" /> Share via WhatsApp</a>
              <button type="button" onClick={() => { setCreated(null); setForm(EMPTY); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] text-[12px] font-semibold"><Plus className="size-4" /> Add another package</button>
            </div>
            <Link href="/logistics/manifests" className="block text-center text-[11px] font-semibold text-[var(--accent)]">Track it in Manifests</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* 1-2: who and where, side by side on wide screens. */}
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {[["sender", "pickup", "Sender & pickup", 1], ["recipient", "delivery", "Recipient & delivery", 2]].map(([who, where, title, n]) => (
                <section key={who} aria-labelledby={`${who}-title`} className={CARD}>
                  <StepTitle n={n} id={`${who}-title`}>{title}</StepTitle>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className={LABEL} htmlFor={`${who}-name`}>Name</label><input id={`${who}-name`} required autoComplete="off" value={form[who].name} onChange={(e) => set(`${who}.name`, e.target.value)} placeholder={who === "sender" ? "Who hands it over" : "Who receives it"} className={FIELD} /></div>
                    <div><label className={LABEL} htmlFor={`${who}-phone`}>Phone</label><input id={`${who}-phone`} required type="tel" inputMode="tel" autoComplete="off" value={form[who].phone} onChange={(e) => set(`${who}.phone`, e.target.value)} placeholder="677 12 34 56" className={`${FIELD} tabular-nums`} /></div>
                  </div>
                  {/* Saved places (the agency's most used pickups and drop-offs) or a new place search. */}
                  <AddressField label={where === "pickup" ? "Pickup location" : "Delivery location"} value={form[where]} onChange={(v) => setForm((f) => ({
                    ...f,
                    [where]: v,
                    // A saved address brings its contact when the fields are still empty.
                    [who]: v.address_id ? { name: f[who].name || v.recipient_name || "", phone: f[who].phone || v.contact_phone || "" } : f[who],
                  }))} />
                </section>
              ))}
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-2">
              <section aria-labelledby="pkg-title" className={CARD}>
                <StepTitle n={3} id="pkg-title">Package</StepTitle>
                <div><label className={LABEL} htmlFor="pkg-desc">What is it?</label><input id="pkg-desc" required value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Two boxes of shoes" className={FIELD} /></div>
                <Chips label="Category" options={CATEGORIES} value={form.category} onChange={(v) => set("category", v)} />
                <Chips label="Size" options={WEIGHTS} value={form.weight_tier} onChange={(v) => set("weight_tier", v)} />
                <details className="group rounded-2xl border border-[var(--glass-border)] px-3.5 py-2.5" open={Boolean(form.reference || form.handling_instructions)}>
                  <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[var(--text-secondary)]">More details (optional) <span className="text-[16px] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div><label className={LABEL} htmlFor="pkg-ref">Your reference</label><input id="pkg-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. INV-2041" className={FIELD} /></div>
                    <div><label className={LABEL} htmlFor="pkg-handling">Handling</label><input id="pkg-handling" value={form.handling_instructions} onChange={(e) => set("handling_instructions", e.target.value)} placeholder="e.g. Keep upright" className={FIELD} /></div>
                  </div>
                </details>
              </section>

              <section aria-labelledby="pay-title" className={CARD}>
                <StepTitle n={4} id="pay-title">Payment</StepTitle>
                <div>
                  <label className={LABEL} htmlFor="pkg-fee">Delivery fee</label>
                  <div className="relative">
                    <input id="pkg-fee" inputMode="numeric" value={form.fee} onChange={(e) => set("fee", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Leave empty: your Route Pricing" className={`${FIELD} pr-14 tabular-nums`} />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-secondary)]">XAF</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Empty: we use your Route Pricing (by quartier or by distance).</p>
                </div>
                <Chips label="Who pays" options={[["sender", "Sender"], ["recipient", "Recipient"]]} value={form.payer}
                  onChange={(v) => setForm((f) => ({ ...f, payer: v, payment_arrangement: v === "recipient" ? "pay_on_delivery" : "paid_to_agency" }))} />
                <Chips label="How" options={[["paid_to_agency", "Already paid to us"], ["pay_on_delivery", "Pay the rider on delivery"], ["agency_account", "On account (invoice later)"]]}
                  value={form.payment_arrangement} onChange={(v) => set("payment_arrangement", v)} />
              </section>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving || !enabled} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white disabled:opacity-50 lg:w-72">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />} Register package
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
