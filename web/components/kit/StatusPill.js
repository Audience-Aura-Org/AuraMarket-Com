/** Status → tone. Unknown statuses render neutral. */
const TONES = {
  good: ['delivered', 'completed', 'paid', 'active', 'approved', 'resolved', 'released', 'successful', 'success', 'verified', 'live'],
  warn: ['pending', 'placed', 'processing', 'awaiting', 'in_transit', 'picked_up', 'assigned', 'out_for_delivery', 'shipped', 'investigating', 'held', 'grace', 'refund_pending', 'review'],
  bad: ['cancelled', 'canceled', 'failed', 'rejected', 'refunded', 'disputed', 'suspended', 'expired', 'banned', 'limited', 'processing_error'],
};

export const toneOf = (status) => {
  const s = String(status || '').toLowerCase();
  if (TONES.good.includes(s)) return 'good';
  if (TONES.bad.includes(s)) return 'bad';
  if (TONES.warn.includes(s)) return 'warn';
  return 'neutral';
};

const CLASS = {
  good: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  bad: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  neutral: 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)]',
};

export default function StatusPill({ status, label, tone }) {
  const t = tone || toneOf(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] lg:text-[11px] font-semibold capitalize ${CLASS[t]}`}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {label || String(status || '—').replace(/_/g, ' ')}
    </span>
  );
}
