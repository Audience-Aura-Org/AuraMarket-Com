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
// Same fields and labels as the address components.
import { FIELD, LABEL } from "@/lib/formStyles";

const CARD = "space-y-3.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5";

function StepTitle({ n, id, children }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-[14px] font-semibold">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white" aria-hidden="true">{n}</span>
      {children}
    </h2>
  );
}

const STEP_TITLES = ["Sender & pickup", "Recipient & delivery", "Package", "Payment"];

/**
 * One step of the form. Open: its fields and Continue. Done: a one-line summary and
 * Edit. Not reached yet: just its title, so the whole form never looks long.
 */
function Step({ n, step, title, summary, onEdit, onNext, last = false, children }) {
  const open = step === n;
  const done = step > n;
  if (!open) {
    return (
      <button type="button" onClick={done ? onEdit : undefined} disabled={!done} aria-label={done ? `Edit ${title}` : title}
        className={`flex w-full items-center gap-3 rounded-3xl border p-3.5 text-left ${done ? "border-[var(--glass-border)] bg-[var(--bg-primary)]" : "border-dashed border-[var(--glass-border)] opacity-60"}`}>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-emerald-600 text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`} aria-hidden="true">{done ? <Check className="size-4" /> : n}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{title}</span>
          {done && summary && <span className="block truncate text-[11px] text-[var(--text-secondary)]">{summary}</span>}
        </span>
        {done && <span className="shrink-0 text-[12px] font-semibold text-[var(--accent)]">Edit</span>}
      </button>
    );
  }
  return (
    <section aria-labelledby={`step-${n}`} className={CARD}>
      <StepTitle n={n} id={`step-${n}`}>{title}</StepTitle>
      {children}
      {!last && (
        <button type="button" onClick={onNext} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white">
          Continue
        </button>
      )}
    </section>
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
  const [step, setStep] = useState(1); // the open step; finished ones fold into a summary
  const set = (path, value) => setForm((f) => {
    const [a, b] = path.split(".");
    return b ? { ...f, [a]: { ...f[a], [b]: value } } : { ...f, [a]: value };
  });

  // What each step needs before moving on; the message says what is missing.
  const missing = (n) => {
    if (n === 1) return !form.sender.name.trim() || !form.sender.phone.trim() ? "Enter the sender's name and phone." : !form.pickup.zone_id ? "Choose the pickup place." : "";
    if (n === 2) return !form.recipient.name.trim() || !form.recipient.phone.trim() ? "Enter the recipient's name and phone." : !form.delivery.zone_id ? "Choose the delivery place." : "";
    if (n === 3) return !form.description.trim() ? "Say what the package is." : "";
    return "";
  };
  const next = (n) => { const m = missing(n); if (m) { toast.error(m); return; } setStep(n + 1); };
  const placeOf = (a) => [a.place_name, a.quartier].filter((v, i, all) => v && all.indexOf(v) === i).join(", ");
  const summary = {
    1: [form.sender.name, form.sender.phone, placeOf(form.pickup)].filter(Boolean).join(" · "),
    2: [form.recipient.name, form.recipient.phone, placeOf(form.delivery)].filter(Boolean).join(" · "),
    3: [form.description, CATEGORIES.find(([v]) => v === form.category)?.[1], WEIGHTS.find(([v]) => v === form.weight_tier)?.[1]].filter(Boolean).join(" · "),
  };

  const submit = async (e) => {
    e.preventDefault();
    const gap = [1, 2, 3].find((n) => missing(n));
    if (gap) { setStep(gap); toast.error(missing(gap)); return; }
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

      <div className="mx-auto w-full max-w-[760px] space-y-4 px-3 py-5 sm:px-5 md:px-8">
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
              <button type="button" onClick={() => { setCreated(null); setForm(EMPTY); setStep(1); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] text-[12px] font-semibold"><Plus className="size-4" /> Add another package</button>
            </div>
            <Link href="/logistics/manifests" className="block text-center text-[11px] font-semibold text-[var(--accent)]">Track it in Manifests</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {/* Progress: short and clear, one step at a time. */}
            <div className="space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between text-[12px]"><span className="font-semibold">Step {step} of 4</span><span className="text-[var(--text-secondary)]">{STEP_TITLES[step - 1]}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(step / 4) * 100}%` }} /></div>
            </div>

            {[["sender", "pickup", 1], ["recipient", "delivery", 2]].map(([who, where, n]) => (
              <Step key={who} n={n} step={step} title={STEP_TITLES[n - 1]} summary={summary[n]} onEdit={() => setStep(n)} onNext={() => next(n)}>
                {/* Saved places first: one tap fills the place and the contact. */}
                <AddressField label={where === "pickup" ? "Pickup location" : "Delivery location"} value={form[where]} onChange={(v) => setForm((f) => ({
                  ...f,
                  [where]: v,
                  [who]: v.address_id ? { name: f[who].name || v.recipient_name || "", phone: f[who].phone || v.contact_phone || "" } : f[who],
                }))} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={LABEL} htmlFor={`${who}-name`}>{who === "sender" ? "Sender's name" : "Recipient's name"}</label><input id={`${who}-name`} autoComplete="off" value={form[who].name} onChange={(e) => set(`${who}.name`, e.target.value)} placeholder={who === "sender" ? "Who hands it over" : "Who receives it"} className={FIELD} /></div>
                  <div><label className={LABEL} htmlFor={`${who}-phone`}>Phone</label><input id={`${who}-phone`} type="tel" inputMode="tel" autoComplete="off" value={form[who].phone} onChange={(e) => set(`${who}.phone`, e.target.value)} placeholder="677 12 34 56" className={`${FIELD} tabular-nums`} /></div>
                </div>
              </Step>
            ))}

            <Step n={3} step={step} title={STEP_TITLES[2]} summary={summary[3]} onEdit={() => setStep(3)} onNext={() => next(3)}>
              <div><label className={LABEL} htmlFor="pkg-desc">What is it?</label><input id="pkg-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Two boxes of shoes" className={FIELD} /></div>
              <Chips label="Category" options={CATEGORIES} value={form.category} onChange={(v) => set("category", v)} />
              <Chips label="Size" options={WEIGHTS} value={form.weight_tier} onChange={(v) => set("weight_tier", v)} />
              <details className="group rounded-2xl border border-[var(--glass-border)] px-3.5 py-2.5" open={Boolean(form.reference || form.handling_instructions)}>
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[var(--text-secondary)]">More details (optional) <span className="text-[16px] transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div><label className={LABEL} htmlFor="pkg-ref">Your reference</label><input id="pkg-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. INV-2041" className={FIELD} /></div>
                  <div><label className={LABEL} htmlFor="pkg-handling">Handling</label><input id="pkg-handling" value={form.handling_instructions} onChange={(e) => set("handling_instructions", e.target.value)} placeholder="e.g. Keep upright" className={FIELD} /></div>
                </div>
              </details>
            </Step>

            <Step n={4} step={step} title={STEP_TITLES[3]} onEdit={() => setStep(4)} last>
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
              <button type="submit" disabled={saving || !enabled} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[14px] font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />} Register package
              </button>
            </Step>
          </form>
        )}
      </div>
    </div>
  );
}
