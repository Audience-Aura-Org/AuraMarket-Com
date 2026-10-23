const GROUPS = ['Overview', 'Operations', 'People & access', 'Finance', 'Communication & support', 'Insights', 'Platform', 'Account'];

const sectionFor = ({ href = '', label = '' }) => {
  if (href.startsWith('/profile') && !href.includes('tab=orders')) return 'Account';
  if (/security|network|verification|alerts/i.test(label)) return 'Account';
  if (href === '/shop' || href === '/manager' || /\/dashboard$/.test(href)) return 'Overview';
  if (/\/admin\/(users|managers|vendors|approvals)$/.test(href)) return 'People & access';
  if (/wallet|withdrawals|treasury|vendor-balance|transactions|subscriptions|subscribe|escrow|pricing|earnings/.test(href)) return 'Finance';
  if (/messages|\/chat$|disputes|stories|tab=status|inbox/.test(href)) return 'Communication & support';
  if (/analytics|performance|ratings|reviews|logistics\/audit/.test(href)) return 'Insights';
  if (/settings|homepage|storefront|email-logs|\/admin\/audit$|journal/.test(href)) return 'Platform';
  return 'Operations';
};

/** Reorder existing links without changing their routes, badges, or click handlers. */
export function groupSidebarItems(items) {
  return GROUPS.flatMap(group => items.filter(item => sectionFor(item) === group)
    .map((item, index) => ({ ...item, groupStart: index === 0 ? group : null })));
}
