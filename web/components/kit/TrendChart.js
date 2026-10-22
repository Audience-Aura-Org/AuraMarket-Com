'use client';

import { useId, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// recharts loads on demand; the placeholder keeps the exact height (no layout shift).
const AreaChartImpl = dynamic(() => import('./AreaChartImpl'), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[1.5rem] bg-[var(--bg-secondary)]/40 animate-pulse" />,
});

const useWide = () => {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined; // old WebViews
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return wide;
};

const defaultFormat = (v) => Number(v || 0).toLocaleString();

/**
 * Vendor-dashboard style area chart (accent line + gradient fill).
 * Shows an empty state when every value is 0. The value axis is hidden on
 * phones to give the line the full width.
 */
export default function TrendChart({
  data = [], xKey = 'label', yKey = 'value', height = 'h-[220px] md:h-[280px]',
  formatValue = defaultFormat, formatTick, formatLabel, seriesLabel,
  emptyTitle = 'No data in this period', emptyHint = 'The chart fills in as activity comes in.',
}) {
  const fillId = `kit-trend-${useId().replace(/:/g, '')}`;
  const wide = useWide();
  const hasData = data.some((d) => Number(d?.[yKey]) > 0);

  if (!hasData) {
    return (
      <div className={`${height} flex items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-6 text-center`}>
        <div className="space-y-1">
          <p className="text-xs font-bold text-[var(--text-primary)]">{emptyTitle}</p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-70">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${height} w-full`} role="img" aria-label={seriesLabel ? `${seriesLabel} chart` : 'Trend chart'}>
      <AreaChartImpl
        data={data} xKey={xKey} yKey={yKey} fillId={fillId} showYAxis={wide}
        formatValue={formatValue} formatTick={formatTick} formatLabel={formatLabel} seriesLabel={seriesLabel}
      />
    </div>
  );
}
