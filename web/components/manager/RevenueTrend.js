'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatNumber } from '@/components/manager/ui';

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="m-card !bg-[var(--m-surface-solid)] px-3 py-2 m-fs-12">
      <p className="m-muted">{shortDate(p.date)}</p>
      <p className="m-num font-medium mt-0.5">{formatMoney(p.revenue)} XAF</p>
      {p.orders != null && <p className="m-num m-muted">{formatNumber(p.orders)} orders</p>}
    </div>
  );
}

/**
 * Daily revenue line. Neutral ink (currentColor) — colour is reserved for
 * status. series: [{ date: 'YYYY-MM-DD', revenue, orders? }]
 */
export default function RevenueTrend({ series = [] }) {
  return (
    <div className="h-[240px] md:h-[280px] w-full text-[var(--m-text)]" role="img" aria-label="Daily revenue chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="m-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.14} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.07} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'currentColor', fillOpacity: 0.45, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatMoney}
            tick={{ fill: 'currentColor', fillOpacity: 0.45, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="url(#m-trend-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
