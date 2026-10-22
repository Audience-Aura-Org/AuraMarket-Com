const TONE_CLASS = { good: 'm-good', bad: 'm-bad', warn: 'm-warn', neutral: 'm-muted' };

function Sparkline({ series }) {
  if (!series?.length) return null;
  const max = Math.max(...series, 1);
  const w = 100;
  const h = 28;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const points = series.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * (h - 2) - 1).toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="m-muted" />
    </svg>
  );
}

/** Metric card: label, value, optional delta ({text, tone}), hint, sparkline. */
export default function Scorecard({ label, value, unit, delta, hint, series }) {
  return (
    <div className="m-card p-4 md:p-5 min-w-0">
      <p className="m-fs-12 m-muted">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="m-headline m-num m-fs-20-28 truncate">{value}</span>
        {unit && <span className="m-fs-12 m-muted">{unit}</span>}
      </p>
      {(delta || hint) && (
        <p className="mt-1 m-fs-12 m-num flex items-center gap-1.5 flex-wrap">
          {delta && <span className={TONE_CLASS[delta.tone] || 'm-muted'}>{delta.text}</span>}
          {hint && <span className="m-muted">{hint}</span>}
        </p>
      )}
      <Sparkline series={series} />
    </div>
  );
}
