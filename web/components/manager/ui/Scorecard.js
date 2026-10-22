const DELTA_PILL = { good: 'm-pill-good', bad: 'm-pill-bad', warn: 'm-pill-warn' };
const ARROW = { good: '▲', bad: '▼' };

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

/**
 * Metric card in the vendor dashboard's style: tinted icon tile, top-right
 * tag, label, big number, a thin progress bar and a footnote in the card's
 * colour. Deltas ({text, tone}) render as a pill.
 *
 * tone: 'good' | 'accent' | 'indigo' | 'warn' | 'bad'
 * progress: 0..1 — a real ratio (omit for no bar)
 */
export default function Scorecard({
  label, value, unit, icon: Icon, tone = 'accent', tag, delta, hint, progress,
}) {
  const showDelta = delta && delta.text && delta.text !== '—';
  return (
    <div className={`m-card m-card-lift m-tint m-tone-${tone} p-4 md:p-5 flex flex-col gap-3 min-w-0 overflow-hidden`}>
      <div className="relative flex items-center justify-between gap-2">
        {Icon ? <span className="m-icon-tile"><Icon className="size-5" aria-hidden="true" /></span> : <span />}
        {tag && <span className="m-fs-11 font-medium m-muted truncate">{tag}</span>}
      </div>
      <div className="relative min-w-0">
        <p className="m-fs-12 font-medium m-muted truncate">{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5 min-w-0">
          <span className="m-headline m-num m-fs-20-28 truncate">{value}</span>
          {unit && <span className="m-fs-12 font-semibold m-muted">{unit}</span>}
        </p>
      </div>
      {progress != null && (
        <div className="m-bar relative" role="presentation">
          <span style={{ width: `${Math.round(clamp01(progress) * 100)}%` }} />
        </div>
      )}
      {(showDelta || hint) && (
        <div className="relative flex items-center gap-2 flex-wrap m-fs-11">
          {showDelta && (
            <span className={`m-pill m-num !py-0.5 !px-2 ${DELTA_PILL[delta.tone] || ''}`}>
              {ARROW[delta.tone] && <span aria-hidden="true">{ARROW[delta.tone]}</span>}
              {delta.text.replace(/^[+-]/, '')}
            </span>
          )}
          {/* Beside a delta pill the hint is context ("vs prior 30 days"), so it stays neutral. */}
          {hint && <span className={`${showDelta ? 'm-muted' : 'm-tone-text'} font-medium truncate`}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
