/**
 * Number and time formatting for the manager workspace.
 * Money is shown compact (4.82M); callers add the currency label.
 */

const trim = (n, digits) => String(Number(n.toFixed(digits)));

export function formatMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6, 2)}M`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3, 1)}K`;
  return `${sign}${Math.round(abs)}`;
}

const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

/** Change vs the previous period. No previous period → no delta. */
export function formatDelta(current, previous) {
  const prev = Number(previous) || 0;
  if (!prev) return { text: '—', tone: 'neutral' };
  const pct = ((Number(current) || 0) - prev) / prev * 100;
  if (pct === 0) return { text: '0.0%', tone: 'neutral' };
  return {
    text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    tone: pct > 0 ? 'good' : 'bad',
  };
}

export function timeAgo(date, now = Date.now()) {
  if (!date) return '';
  const diff = Math.max(0, now - new Date(date).getTime());
  const mins = Math.floor(diff / 60e3);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
