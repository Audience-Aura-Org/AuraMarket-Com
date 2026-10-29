"use client";
/**
 * Agency: how many deliveries one rider may hold at once, counting accepted ones and
 * offers waiting for an answer (GET/PATCH /logistics/rider-rules). Free riders are
 * always offered first; a rider at the limit gets no new offers until one is done.
 */
import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";

export default function RiderLimit() {
  const [value, setValue] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/logistics/rider-rules", { skipClientCache: true })
      .then((res) => { const n = res.data?.data?.max_active_per_rider; setValue(n); setSaved(n); })
      .catch(() => {});
  }, []);

  const save = async (n) => {
    setValue(n);
    setSaving(true);
    try {
      const res = await api.patch("/logistics/rider-rules", { max_active_per_rider: n });
      setSaved(res.data?.data?.max_active_per_rider);
      toast.success(n === 1 ? "Riders now carry one delivery at a time." : `Riders can now carry up to ${n} deliveries at once.`);
    } catch (err) {
      setValue(saved);
      toast.error(err?.response?.data?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (value == null) return null;
  return (
    <div className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:p-5">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-semibold"><Layers className="size-4 text-[var(--accent)]" /> Deliveries a rider can carry at once {saving && <Loader2 className="size-3.5 animate-spin" />}</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Free riders always get offers first. Riders can also take waiting deliveries themselves, up to this number.</p>
      </div>
      <div role="radiogroup" aria-label="Deliveries at once" className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} disabled={saving} onClick={() => value !== n && save(n)}
            className={`min-h-10 min-w-11 rounded-2xl border px-3 text-[13px] font-semibold tabular-nums ${value === n ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--glass-border)]"}`}>{n}</button>
        ))}
      </div>
    </div>
  );
}
