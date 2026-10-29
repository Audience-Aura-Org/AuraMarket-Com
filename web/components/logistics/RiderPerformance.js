'use client';
/**
 * Agency analytics: how each rider performs on offers and deliveries, and how
 * well dispatch works overall (GET /logistics/riders/report).
 */
import { useCallback, useEffect, useState } from 'react';
import { Bike, Loader2 } from 'lucide-react';
import api from '@/services/api';

const PERIODS = [7, 30, 90];
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, unit = '') => (v == null ? '—' : `${v.toLocaleString()}${unit}`);

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
      <p className="text-[10px] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-[16px] font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

export default function RiderPerformance() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/logistics/riders/report', { params: { days }, skipClientCache: true }); setData(res.data?.data || null); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const d = data?.dispatch;
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 sm:rounded-[2rem] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[14px] font-bold"><Bike className="size-4 text-[var(--accent)]" /> Rider performance</h3>
        <div className="flex rounded-xl bg-[var(--bg-secondary)] p-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p}
              className={`min-h-8 rounded-lg px-3 text-[11px] font-semibold ${days === p ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>{p} days</button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-[var(--accent)]" /></div>
      ) : !data ? (
        <p className="text-[11px] text-[var(--text-secondary)]">Could not load the rider report.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Deliveries offered" value={num(d.deliveries_offered)} />
            <Stat label="Offers per delivery" value={num(d.offers_per_delivery)} hint="1 is ideal" />
            <Stat label="Taken by first rider" value={pct(d.first_offer_success)} hint="of completed deliveries" />
            <Stat label="Sent automatically" value={pct(d.auto_share)} />
          </div>

          {data.riders.length === 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)]">No riders yet. Invite them from the Riders page.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <thead className="text-[10px] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Rider</th>
                    <th className="px-2 py-2 text-right font-semibold">Offers</th>
                    <th className="px-2 py-2 text-right font-semibold">Accepted</th>
                    <th className="px-2 py-2 text-right font-semibold">Missed</th>
                    <th className="px-2 py-2 text-right font-semibold">Delivered</th>
                    <th className="px-2 py-2 text-right font-semibold">Answers in</th>
                    <th className="px-2 py-2 text-right font-semibold">Delivery time</th>
                    <th className="px-2 py-2 text-right font-semibold">Cash held</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {data.riders.map((r) => (
                    <tr key={r.rider_id}>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-[10px] capitalize text-[var(--text-secondary)]">{r.status === 'active' ? r.availability : r.status}</p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.offers}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.accepted} <span className="text-[var(--text-secondary)]">({pct(r.acceptance_rate)})</span></td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${r.missed ? 'text-amber-600' : ''}`}>{r.missed}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.completed}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{num(r.avg_response_seconds, ' s')}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{num(r.avg_delivery_minutes, ' min')}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{r.cash_holding ? `${r.cash_holding.toLocaleString()} XAF` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
