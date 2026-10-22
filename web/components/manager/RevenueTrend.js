'use client';

import TrendChart from '@/components/kit/TrendChart';
import { formatMoney } from '@/components/manager/ui';

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const ARROW = { good: '▲', bad: '▼' };
const PILL = { good: 'm-pill-good', bad: 'm-pill-bad' };

/**
 * Daily revenue area chart (vendor dashboard style). Uses the shared kit
 * chart, which lazy-loads recharts so the manager's cards paint first.
 * series: [{ date: 'YYYY-MM-DD', revenue }]
 */
export default function RevenueTrend({ series = [], height = 'h-[220px] md:h-[280px]' }) {
  return (
    <TrendChart
      data={series}
      xKey="date"
      yKey="revenue"
      height={height}
      seriesLabel="XAF"
      formatValue={formatMoney}
      formatTick={shortDate}
      formatLabel={shortDate}
      emptyTitle="No revenue in this period"
      emptyHint="The chart fills in as paid orders come in."
    />
  );
}

/** Chart panel with the vendor header: title, subtitle, growth pill and a live chip. */
export function TrendPanel({ title = 'Revenue trend', subtitle, series, delta, deltaLabel = 'vs prior period', className = '' }) {
  const showDelta = delta && delta.text && delta.text !== '—';
  return (
    <section className={`m-card p-5 md:p-6 ${className}`} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="m-headline m-fs-15">{title}</h2>
          {subtitle && <p className="m-fs-11 font-semibold m-muted opacity-70">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showDelta && (
            <span className={`m-pill m-fs-11 m-num ${PILL[delta.tone] || ''}`}>
              {ARROW[delta.tone] && <span aria-hidden="true">{ARROW[delta.tone]}</span>}
              {delta.text.replace(/^[+-]/, '')} <span className="font-medium">{deltaLabel}</span>
            </span>
          )}
          <span className="m-pill m-fs-11 m-muted !font-medium">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" /> Live analysis
          </span>
        </div>
      </div>
      <RevenueTrend series={series} />
    </section>
  );
}
