"use client";
/**
 * Agency: how riders are paid per completed delivery (GET/PATCH /logistics/rider-pay).
 * Each delivery records the pay at the rate in force when it ends, so changing
 * the rate never rewrites past earnings.
 */
import { useEffect, useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";

const FIELD = "min-h-11 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

export default function RiderPayRate() {
  const [mode, setMode] = useState("");
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/logistics/rider-pay", { skipClientCache: true }).then((res) => {
      const r = res.data?.data?.rider_pay;
      setSaved(r || null);
      setMode(r?.mode || "");
      setValue(r?.value != null ? String(r.value) : "");
    }).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch("/logistics/rider-pay", mode ? { mode, value: Number(value) } : { mode: null });
      setSaved(res.data?.data?.rider_pay || null);
      toast.success(mode ? "Rider pay rate saved. It applies to deliveries finished from now on." : "Rider pay is no longer tracked.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save the pay rate.");
    } finally {
      setSaving(false);
    }
  };

  const changed = (saved?.mode || "") !== mode || String(saved?.value ?? "") !== value;
  return (
    <form onSubmit={save} className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-semibold"><HandCoins className="size-4 text-[var(--accent)]" /> How you pay riders</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Riders see what they earned on each delivery and what you still owe them. Changes apply to deliveries finished from now on.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Pay type" className={FIELD}>
          <option value="">Not tracked in Auradime</option>
          <option value="percent">% of each delivery fee</option>
          <option value="fixed">Fixed amount per delivery</option>
        </select>
        {mode && (
          <div className="relative">
            <input required inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={mode === "percent" ? "Percentage" : "Amount (XAF)"}
              placeholder={mode === "percent" ? "e.g. 60" : "e.g. 500"} className={`${FIELD} w-32 pr-12 tabular-nums`} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-secondary)]">{mode === "percent" ? "%" : "XAF"}</span>
          </div>
        )}
        <button type="submit" disabled={saving || !changed || (mode && !value)} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-[12px] font-semibold text-white disabled:opacity-40">
          {saving && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
      {mode === "percent" && value && <p className="text-[11px] text-[var(--text-secondary)]">Example: on a 1,500 XAF delivery, the rider earns {Math.round(1500 * Number(value) / 100).toLocaleString()} XAF.</p>}
    </form>
  );
}
