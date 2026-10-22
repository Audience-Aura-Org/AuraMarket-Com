'use client';

import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatNumber } from '@/components/manager/ui';
import { useMinWidth } from '@/components/manager/shell/useMinWidth';

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const ARROW = { good: '▲', bad: '▼' };
const PILL = { good: 'm-pill-good', bad: 'm-pill-bad' };

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-[14px] border border-[var(--m-border)] bg-[var(--m-surface-solid)] px-3 py-2 m-fs-12 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
      <p className="m-muted">{shortDate(p.date)}</p>
      <p className="m-num font-semibold mt-0.5">{formatMoney(p.revenue)} XAF</p>
      {p.orders != null && <p className="m-num m-muted">{formatNumber(p.orders)} orders</p>}
    </div>
  );
}

/**
 * Daily revenue area chart in the vendor dashboard's style: accent line,
 * accent gradient fill, faint grid. The value axis is hidden on phones.
 * series: [{ date: 'YYYY-MM-DD', revenue, orders? }]
 */
export default function RevenueTrend({ series = [], height = 'h-[220px] md:h-[280px]' }) {
  const fillId = `m-trend-${useId().replace(/:/g, '')}`;
  const wide = useMinWidth(768);
  const hasData = series.some((d) => Number(d.revenue) > 0);

  if (!hasData) {
    return (
      <div className={`${height} flex items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--m-border)] bg-[var(--bg-secondary)]/30 text-center px-6`}>
        <div className="space-y-1">
          <p className="m-fs-12 font-semibold">No revenue in this period</p>
          <p className="m-fs-11 m-muted">The chart fills in as paid orders come in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${height} w-full`} role="img" aria-label="Daily revenue chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 12, right: 8, bottom: 0, left: wide ? 0 : -8 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.32} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'var(--text-secondary)', fillOpacity: 0.65, fontSize: 10, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            minTickGap={wide ? 24 : 32}
          />
          <YAxis
            hide={!wide}
            tickFormatter={formatMoney}
            tick={{ fill: 'var(--text-secondary)', fillOpacity: 0.65, fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.25 }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--accent)"
            strokeWidth={3}
            fill={`url(#${fillId})`}
            activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
