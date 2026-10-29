"use client";
/**
 * Rider: today at a glance and earnings (GET /riders/me/summary), with a link to
 * the full history. Earnings show only once the agency has set a pay rate.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, ChevronRight, History, Wallet } from "lucide-react";
import api from "@/services/api";

const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;
const rateText = (r) => (r?.mode === "percent" ? `${r.value}% of each delivery fee` : r?.mode === "fixed" ? `${xaf(r.value)} per delivery` : null);

function Tile({ label, value, tone = "" }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] px-3 py-2.5">
      <p className="text-[10px] text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default function RiderSummary({ refreshKey, showCash = false }) {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    try { const res = await api.get("/riders/me/summary", { skipClientCache: true }); setData(res.data?.data || null); } catch { /* keep last */ }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load, refreshKey]);

  if (!data) return null;
  const paid = Boolean(data.pay_rule);
  return (
    <div className="space-y-3">
      <section className="space-y-2.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <p className="text-[13px] font-semibold">Today</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Delivered" value={data.today.delivered} />
          <Tile label="Couldn't deliver" value={data.today.failed} tone={data.today.failed ? "text-amber-600" : ""} />
          <Tile label="Offers missed" value={data.today.missed_offers} tone={data.today.missed_offers ? "text-amber-600" : ""} />
          <Tile label="Earned" value={paid ? xaf(data.today.earned) : "—"} tone={paid ? "text-emerald-600" : ""} />
        </div>
      </section>

      <section className="space-y-2.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Wallet className="size-4 text-[var(--accent)]" /> Earnings</p>
          {paid && <span className="text-[10px] text-[var(--text-secondary)]">{rateText(data.pay_rule)}</span>}
        </div>
        {paid ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label={`This week · ${data.week.delivered} deliveries`} value={xaf(data.week.earned)} />
              <Tile label={`This month · ${data.month.delivered}`} value={xaf(data.month.earned)} />
              <Tile label="Paid to you" value={xaf(data.earnings.paid)} />
              <Tile label="Your agency owes you" value={xaf(data.earnings.owed)} tone={data.earnings.owed ? "text-emerald-600" : ""} />
            </div>
            {data.earnings.last_paid_at && <p className="text-[10px] text-[var(--text-secondary)]">Last payment recorded {new Date(data.earnings.last_paid_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}.</p>}
          </>
        ) : (
          <p className="text-[11px] text-[var(--text-secondary)]">Your agency has not set a pay rate in Auradime yet, so earnings are not tracked here. Ask them how you are paid.</p>
        )}
        {showCash && data.cash_holding > 0 && (
          <p className="flex items-center gap-1.5 rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700"><Banknote className="size-4 shrink-0" /> You are holding {xaf(data.cash_holding)} cash for your agency.</p>
        )}
      </section>

      <Link href="/rider/history" className="flex items-center gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4">
        <History className="size-5 text-[var(--accent)]" />
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">All my deliveries</span><span className="block text-[10px] text-[var(--text-secondary)]">History with what you earned on each</span></span>
        <ChevronRight className="size-4 text-[var(--text-secondary)]" />
      </Link>
    </div>
  );
}
