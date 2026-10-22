import { getWorkspaceNav } from './workspaceNav';

/** Lower = more urgent. Used everywhere accounts are ordered by health. */
export const HEALTH_RANK = { urgent: 0, attention: 1, ok: 2 };
const rank = (a) => HEALTH_RANK[a.health] ?? 3;

/**
 * Where selecting `accountId` in the picker should navigate, or null when
 * nothing should happen (already in that account).
 *
 * Keeps the current workspace section (e.g. Orders) only if the target
 * account type has it; detail pages such as products/edit never carry over.
 */
export function resolveSwitchTarget({ pathname, accountId, actAsId, accounts }) {
  if (!accountId) return '/manager';
  if (accountId === actAsId && pathname.startsWith(`/manager/as/${accountId}`)) return null;

  const target = accounts.find((a) => a.id === accountId);
  const section = pathname.match(/^\/manager\/as\/[^/]+\/([^/?#]+)/)?.[1];
  const keep = section && getWorkspaceNav(target?.role).some((n) => n.slug === section);
  return `/manager/as/${accountId}/${keep ? section : 'dashboard'}`;
}

/**
 * Picker sections. Starred/recent are persisted ids, so they are resolved
 * against the live accounts list: accounts the manager lost access to
 * disappear, and current names/health are used.
 */
export function pickerSections({ accounts, starred = [], recent = [], query = '' }) {
  const q = query.trim().toLowerCase();
  const matches = (a) =>
    !q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const resolve = (list) => list.map((s) => byId.get(s.id)).filter(Boolean).filter(matches);

  return {
    starred: resolve(starred),
    recent: resolve(recent),
    all: accounts
      .filter(matches)
      .sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '')),
  };
}
