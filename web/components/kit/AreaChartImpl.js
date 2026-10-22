'use client';

/**
 * The recharts implementation behind <TrendChart>. Kept in its own module so
 * recharts (one of the largest libraries in the app) only downloads when a
 * chart is actually on screen — cards and numbers paint first.
 */
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ChartTooltip({ active, payload, label, formatValue, formatLabel, seriesLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[14px] border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{formatLabel ? formatLabel(label) : label}</p>
      <p className="text-[12px] font-bold tabular-nums text-[var(--text-primary)]">
        {formatValue(payload[0].value)} {seriesLabel && <span className="font-medium text-[var(--text-secondary)]">{seriesLabel}</span>}
      </p>
    </div>
  );
}

export default function AreaChartImpl({
  data, xKey, yKey, fillId, showYAxis, formatValue, formatTick, formatLabel, seriesLabel,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: showYAxis ? 0 : -8 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatTick}
          tick={{ fill: 'var(--text-secondary)', fillOpacity: 0.65, fontSize: 10, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          hide={!showYAxis}
          tickFormatter={formatValue}
          tick={{ fill: 'var(--text-secondary)', fillOpacity: 0.65, fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          content={<ChartTooltip formatValue={formatValue} formatLabel={formatLabel} seriesLabel={seriesLabel} />}
          cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.25 }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke="var(--accent)"
          strokeWidth={3}
          fill={`url(#${fillId})`}
          activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
