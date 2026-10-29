"use client";
/**
 * Agency: how delivery fees are worked out (GET/PATCH /logistics/pricing/rules).
 * By quartier uses the rate list below; by distance charges a base fee plus a price
 * per road km from pickup to drop-off, between a minimum and an optional maximum.
 * Trips between two cities use a fixed price for the city pair, else the cross-city
 * rate. A preview prices any trip with the numbers on screen before saving.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Calculator, Loader2, Plus, Route, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";

const FIELD = "min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";
const LABEL = "mb-1 block text-[11px] font-medium text-[var(--text-secondary)]";
const digits = (v) => String(v ?? "").replace(/[^0-9]/g, "");
const num = (v) => (v === "" || v == null ? undefined : Number(v));
const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;

const RATE_FIELDS = [
  ["base_fee", "Base fee", "XAF"],
  ["per_km", "Price per km", "XAF"],
  ["min_fee", "Minimum", "XAF"],
  ["max_fee", "Maximum (0 = no cap)", "XAF"],
];

const toForm = (p = {}) => ({
  mode: p.mode || "district",
  base_fee: String(p.base_fee ?? 500), per_km: String(p.per_km ?? 150), min_fee: String(p.min_fee ?? 500), max_fee: String(p.max_fee ?? 0), round_to: String(p.round_to ?? 50),
  cross_city: {
    enabled: Boolean(p.cross_city?.enabled),
    base_fee: String(p.cross_city?.base_fee ?? 2000), per_km: String(p.cross_city?.per_km ?? 50), min_fee: String(p.cross_city?.min_fee ?? 2000), max_fee: String(p.cross_city?.max_fee ?? 0),
    city_pairs: (p.cross_city?.city_pairs || []).map((c) => ({ from_city: c.from_city, to_city: c.to_city, price: String(c.price) })),
  },
});

const toPayload = (f) => ({
  mode: f.mode,
  base_fee: num(f.base_fee), per_km: num(f.per_km), min_fee: num(f.min_fee), max_fee: num(f.max_fee), round_to: num(f.round_to) || 1,
  cross_city: {
    enabled: f.cross_city.enabled,
    base_fee: num(f.cross_city.base_fee), per_km: num(f.cross_city.per_km), min_fee: num(f.cross_city.min_fee), max_fee: num(f.cross_city.max_fee),
    city_pairs: f.cross_city.city_pairs.filter((c) => c.from_city.trim() || c.to_city.trim() || c.price).map((c) => ({ from_city: c.from_city.trim(), to_city: c.to_city.trim(), price: num(c.price) })),
  },
});

// Same sum as the server, for the instant example line.
const estimate = (r, km, roundTo) => {
  let fee = (Number(r.base_fee) || 0) + (Number(r.per_km) || 0) * km;
  fee = Math.max(fee, Number(r.min_fee) || 0);
  if (Number(r.max_fee) > 0) fee = Math.min(fee, Number(r.max_fee));
  const step = Number(roundTo) || 1;
  return Math.ceil(fee / step) * step;
};

function Amount({ id, label, ariaLabel, value, onChange, unit = "XAF" }) {
  return (
    <div>
      {label && <label htmlFor={id} className={LABEL}>{label}</label>}
      <div className="relative">
        <input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(digits(e.target.value))} aria-label={label ? undefined : ariaLabel} className={`${FIELD} pr-12 tabular-nums`} />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-secondary)]">{unit}</span>
      </div>
    </div>
  );
}

export default function DistancePricing({ zones = [], onModeChange }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState("");
  const [cities, setCities] = useState([]);
  const [newCity, setNewCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState({ from: "", to: "" });
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const quartierNames = useMemo(() => zones.filter((z) => z.type === "quartier").map((z) => z.name).sort((a, b) => a.localeCompare(b)), [zones]);
  const cityNames = useMemo(() => zones.filter((z) => z.type === "city").map((z) => z.name).sort((a, b) => a.localeCompare(b)), [zones]);

  useEffect(() => {
    api.get("/logistics/pricing/rules", { skipClientCache: true }).then((res) => {
      const d = res.data?.data || {};
      const f = toForm(d.pricing);
      setForm(f);
      setCities(d.service_regions || []);
      setSaved(JSON.stringify([toPayload(f), d.service_regions || []]));
      onModeChange?.(f.mode);
    }).catch(() => toast.error("Could not load your pricing rules."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) {
    return <div className="flex min-h-24 items-center justify-center rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]"><Loader2 className="size-5 animate-spin text-[var(--text-secondary)]" /></div>;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCross = (k, v) => setForm((f) => ({ ...f, cross_city: { ...f.cross_city, [k]: v } }));
  const setPair = (i, k, v) => setCross("city_pairs", form.cross_city.city_pairs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const changed = JSON.stringify([toPayload(form), cities]) !== saved;
  const distance = form.mode === "distance";

  const addCity = () => {
    const c = newCity.trim();
    if (!c) return;
    if (!cities.some((x) => x.toLowerCase() === c.toLowerCase())) setCities([...cities, c]);
    setNewCity("");
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch("/logistics/pricing/rules", { pricing: toPayload(form), service_regions: cities });
      const d = res.data?.data || {};
      const f = toForm(d.pricing);
      setForm(f);
      setCities(d.service_regions || []);
      setSaved(JSON.stringify([toPayload(f), d.service_regions || []]));
      onModeChange?.(f.mode);
      toast.success(f.mode === "distance" ? "Distance pricing saved. New orders use it right away." : "Saved. Fees come from your quartier list.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save your pricing.");
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    if (!trip.from || !trip.to) { toast.error("Choose a pickup and a drop-off quartier."); return; }
    setQuoting(true); setQuote(null);
    try {
      const res = await api.post("/logistics/pricing/preview", { pickup: { quartier: trip.from }, dropoff: { quartier: trip.to }, pricing: toPayload(form), service_regions: cities });
      setQuote(res.data?.data || null);
    } catch (err) {
      setQuote({ error: err?.response?.data?.message || "Could not price this trip." });
    } finally {
      setQuoting(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-semibold"><Route className="size-4 text-[var(--accent)]" /> How delivery fees are worked out</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Customers see this fee at checkout. Orders already placed keep the fee they were charged.</p>
        </div>
        <div role="radiogroup" aria-label="Pricing mode" className="inline-flex rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1">
          {[["district", "By quartier"], ["distance", "By distance"]].map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={form.mode === value} onClick={() => set("mode", value)}
              className={`min-h-9 rounded-xl px-3.5 text-[12px] font-semibold transition ${form.mode === value ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!distance ? (
        <p className="rounded-2xl bg-[var(--bg-secondary)] p-3 text-[11px] text-[var(--text-secondary)]">Each delivery costs the price you set for the customer&apos;s quartier in the list below. Switch to <strong className="text-[var(--text-primary)]">By distance</strong> to charge by the road km from the vendor (or pickup) to the customer.</p>
      ) : (
        <>
          <fieldset className="space-y-3">
            <legend className="mb-2 text-[12px] font-semibold">Within a city</legend>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {RATE_FIELDS.map(([k, label]) => <Amount key={k} id={`dp-${k}`} label={label} value={form[k]} onChange={(v) => set(k, v)} />)}
              <Amount id="dp-round" label="Round up to" value={form.round_to} onChange={(v) => set("round_to", v)} />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Example: a 3 km trip costs <strong className="text-[var(--text-primary)]">{xaf(estimate(form, 3, form.round_to))}</strong>, 8 km costs <strong className="text-[var(--text-primary)]">{xaf(estimate(form, 8, form.round_to))}</strong>.
            </p>
          </fieldset>

          <div className="space-y-2">
            <p className="text-[12px] font-semibold">Cities you deliver in</p>
            <div className="flex flex-wrap gap-1.5">
              {cities.map((c) => (
                <span key={c} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-3 pr-1 text-[11px] font-semibold">
                  {c}
                  <button type="button" aria-label={`Remove ${c}`} onClick={() => setCities(cities.filter((x) => x !== c))} className="rounded-full p-1 hover:bg-[var(--accent)]/10"><X className="size-3" /></button>
                </span>
              ))}
              {!cities.length && <span className="text-[11px] text-[var(--text-secondary)]">None listed: you are offered in every city.</span>}
            </div>
            <div className="flex gap-2">
              <input list="dp-cities" value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }} placeholder="Add a city" aria-label="Add a city" className={`${FIELD} max-w-xs`} />
              <button type="button" onClick={addCity} className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-[var(--glass-border)] px-4 text-[12px] font-semibold"><Plus className="size-4" /> Add</button>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-2xl border border-[var(--glass-border)] p-3 sm:p-4">
            <legend className="px-1 text-[12px] font-semibold">Between cities</legend>
            <label className="flex cursor-pointer items-center gap-2.5 text-[12px]">
              <input type="checkbox" checked={form.cross_city.enabled} onChange={(e) => setCross("enabled", e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Take deliveries from one city to another
            </label>
            {form.cross_city.enabled && (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] text-[var(--text-secondary)]">Fixed prices for city pairs (same price both ways):</p>
                  <div className="space-y-2">
                    {form.cross_city.city_pairs.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:grid-cols-[1fr_auto_1fr_9rem_auto]">
                        <input list="dp-cities" value={c.from_city} onChange={(e) => setPair(i, "from_city", e.target.value)} placeholder="City" aria-label="From city" className={FIELD} />
                        <ArrowLeftRight className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
                        <input list="dp-cities" value={c.to_city} onChange={(e) => setPair(i, "to_city", e.target.value)} placeholder="City" aria-label="To city" className={FIELD} />
                        <div className="col-span-2 sm:col-span-1"><Amount id={`dp-pair-${i}`} ariaLabel="Price for this pair" value={c.price} onChange={(v) => setPair(i, "price", v)} /></div>
                        <button type="button" aria-label="Remove this pair" onClick={() => setCross("city_pairs", form.cross_city.city_pairs.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center rounded-2xl border border-[var(--glass-border)] text-rose-600"><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setCross("city_pairs", [...form.cross_city.city_pairs, { from_city: "", to_city: "", price: "" }])} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-[var(--glass-border)] px-3.5 text-[12px] font-semibold"><Plus className="size-4" /> Add a city pair</button>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] text-[var(--text-secondary)]">Other city pairs are charged by distance:</p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {RATE_FIELDS.map(([k, label]) => <Amount key={k} id={`dp-x-${k}`} label={label} value={form.cross_city[k]} onChange={(v) => setCross(k, v)} />)}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">Example: a 240 km trip costs <strong className="text-[var(--text-primary)]">{xaf(estimate(form.cross_city, 240, form.round_to))}</strong>.</p>
                </div>
              </>
            )}
          </fieldset>

          <div className="space-y-2 rounded-2xl bg-[var(--bg-secondary)] p-3 sm:p-4">
            <p className="flex items-center gap-2 text-[12px] font-semibold"><Calculator className="size-4 text-[var(--accent)]" /> Try a trip</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input list="dp-quartiers" value={trip.from} onChange={(e) => setTrip({ ...trip, from: e.target.value })} placeholder="Pickup quartier" aria-label="Pickup quartier" className={FIELD} />
              <input list="dp-quartiers" value={trip.to} onChange={(e) => setTrip({ ...trip, to: e.target.value })} placeholder="Drop-off quartier" aria-label="Drop-off quartier" className={FIELD} />
              <button type="button" onClick={preview} disabled={quoting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/40 px-4 text-[12px] font-semibold text-[var(--accent)] disabled:opacity-50">
                {quoting && <Loader2 className="size-4 animate-spin" />} Price it
              </button>
            </div>
            {quote && (quote.error
              ? <p role="alert" className="text-[11px] text-rose-600">{quote.error}</p>
              : <p className="text-[12px]" aria-live="polite">
                  <strong className="text-[15px] tabular-nums">{xaf(quote.fee)}</strong>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {quote.rule === "city_pair" ? ` · fixed ${quote.from_city} – ${quote.to_city} price` : ` · ${quote.approx ? "about " : ""}${quote.distance_km} km by road${quote.cross_city ? ` · ${quote.from_city} → ${quote.to_city}` : ""}`}
                  </span>
                </p>)}
            <p className="text-[10px] text-[var(--text-secondary)]">Quartier centres here; real orders use the exact spots the vendor and customer pinned.</p>
          </div>
        </>
      )}

      <datalist id="dp-cities">{cityNames.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dp-quartiers">{quartierNames.map((q) => <option key={q} value={q} />)}</datalist>

      <div className="flex justify-end">
        <button type="submit" disabled={saving || !changed} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-6 text-[12px] font-semibold text-white disabled:opacity-40">
          {saving && <Loader2 className="size-4 animate-spin" />} Save pricing
        </button>
      </div>
    </form>
  );
}
