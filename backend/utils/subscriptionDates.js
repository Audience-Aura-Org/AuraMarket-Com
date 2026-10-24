const invalid = message => Object.assign(new Error(message), { statusCode: 400 });
const asDate = (value, name) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw invalid(`${name} must be a valid date.`);
  return date;
};
function calculateExpiry(cycle, durationDays, start = new Date()) {
  const date = asDate(start, 'Start date');
  const days = Number(durationDays || 0);
  if (!Number.isFinite(days) || days < 0) throw invalid('Duration must be a non-negative number.');
  if (days > 0) return new Date(date.getTime() + days * 86400000);
  if (!['monthly', 'yearly'].includes(cycle)) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (cycle === 'monthly' ? 1 : 12));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}
function activationDates({ startedAt, expiresAt, cycle, durationDays }) {
  const start = startedAt == null ? new Date() : asDate(startedAt, 'Start date');
  const expiry = expiresAt === undefined ? calculateExpiry(cycle, durationDays, start)
    : expiresAt === null ? null : asDate(expiresAt, 'Expiry date');
  if (expiry && expiry <= start) throw invalid('Expiry must be after the start date.');
  return { start, expiry };
}
function subscriptionReturnUrl(base, redirect, gateway, reference) {
  const origin = new URL(base).origin;
  let url = new URL('/wallet/verify', origin);
  try { const requested = new URL(redirect); if (requested.origin === origin && requested.pathname === '/wallet/verify') url = requested; } catch {}
  url.searchParams.set('gateway', gateway);
  url.searchParams.set('type', 'subscription');
  url.searchParams.set('ref', reference);
  return url.toString();
}
module.exports = { calculateExpiry, activationDates, subscriptionReturnUrl };
