import { HEALTH_RANK } from './switching';

/** The Accounts home headline. */
export function briefingHeadline(accounts = []) {
  if (!accounts.length) return 'No accounts yet';
  const n = accounts.filter((a) => a.health && a.health !== 'ok').length;
  if (!n) return 'All accounts are on track';
  return `${n} ${n === 1 ? 'account needs' : 'accounts need'} you today`;
}

/** Most urgent first, then most open tasks, then name. */
export function sortAccounts(accounts = []) {
  return [...accounts].sort(
    (a, b) =>
      (HEALTH_RANK[a.health] ?? 3) - (HEALTH_RANK[b.health] ?? 3) ||
      (b.tasks || 0) - (a.tasks || 0) ||
      (a.name || '').localeCompare(b.name || '')
  );
}
