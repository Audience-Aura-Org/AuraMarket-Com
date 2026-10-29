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
import LocationPicker from "@/components/location/LocationPicker";
import { LogisticsSubpageHeader } from "@/components/logistics/LogisticsSubpageShell";
import { useFeatureFlag } from "@/lib/featureFlags";
import AssignRiderPanel from "@/components/logistics/AssignRiderPanel";

const FIELD = "min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[12px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]";
const LABEL = "mb-1.5 block text-[12px] font-medium text-[var(--text-primary)]";
const CARD = "space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5";
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

      <div className="mx-auto w-full max-w-[860px] space-y-4 px-3 py-5 sm:px-5 md:px-8">
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
            <div className={CARD}>
              <p className="flex items-center gap-2 text-[12px] font-semibold"><Package className="size-4 text-[var(--accent)]" /> Package</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={LABEL} htmlFor="pkg-desc">What is it?</label><input id="pkg-desc" required value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Two boxes of shoes" className={FIELD} /></div>
                <div><label className={LABEL} htmlFor="pkg-cat">Category</label><select id="pkg-cat" value={form.category} onChange={(e) => set("category", e.target.value)} className={FIELD}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className={LABEL} htmlFor="pkg-weight">Size</label><select id="pkg-weight" value={form.weight_tier} onChange={(e) => set("weight_tier", e.target.value)} className={FIELD}>{WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className={LABEL} htmlFor="pkg-ref">Your reference (optional)</label><input id="pkg-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. INV-2041" className={FIELD} /></div>
                <div><label className={LABEL} htmlFor="pkg-handling">Handling instructions (optional)</label><input id="pkg-handling" value={form.handling_instructions} onChange={(e) => set("handling_instructions", e.target.value)} placeholder="e.g. Keep upright" className={FIELD} /></div>
              </div>
            </div>

            {[["sender", "pickup", "Sender & pickup"], ["recipient", "delivery", "Recipient & delivery"]].map(([who, where, title]) => (
              <div key={who} className={CARD}>
                <p className="text-[12px] font-semibold">{title}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={LABEL} htmlFor={`${who}-name`}>Name</label><input id={`${who}-name`} required value={form[who].name} onChange={(e) => set(`${who}.name`, e.target.value)} className={FIELD} /></div>
                  <div><label className={LABEL} htmlFor={`${who}-phone`}>Phone</label><input id={`${who}-phone`} required inputMode="tel" value={form[who].phone} onChange={(e) => set(`${who}.phone`, e.target.value)} placeholder="677 12 34 56" className={FIELD} /></div>
                </div>
                <LocationPicker label={where === "pickup" ? "Pickup location" : "Delivery location"} value={form[where]} onChange={(v) => set(where, v)} />
              </div>
            ))}

            <div className={CARD}>
              <p className="text-[12px] font-semibold">Payment</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={LABEL} htmlFor="pkg-fee">Delivery fee (XAF)</label><input id="pkg-fee" inputMode="numeric" value={form.fee} onChange={(e) => set("fee", e.target.value.replace(/\D/g, ""))} placeholder="From your Route Pricing" className={`${FIELD} tabular-nums`} /></div>
                <div><label className={LABEL} htmlFor="pkg-payer">Who pays</label><select id="pkg-payer" value={form.payer} onChange={(e) => setForm((f) => ({ ...f, payer: e.target.value, payment_arrangement: e.target.value === "recipient" ? "pay_on_delivery" : "paid_to_agency" }))} className={FIELD}><option value="sender">Sender</option><option value="recipient">Recipient</option></select></div>
                <div><label className={LABEL} htmlFor="pkg-arr">How</label><select id="pkg-arr" value={form.payment_arrangement} onChange={(e) => set("payment_arrangement", e.target.value)} className={FIELD}><option value="paid_to_agency">Already paid to us</option><option value="pay_on_delivery">Pay the rider on delivery</option><option value="agency_account">On account (invoice later)</option></select></div>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">Leave the fee empty to use your Route Pricing (by quartier or by distance).</p>
            </div>

            <button type="submit" disabled={saving || !enabled} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[13px] font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />} Register package
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
