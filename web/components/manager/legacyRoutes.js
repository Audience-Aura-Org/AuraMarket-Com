/** Pre-redesign manager URLs → their home in the five-section workspace. */
export const LEGACY_ROUTES = {
  accounts: '/manager',
  tasks: '/manager/inbox',
  orders: '/manager/inbox?tab=orders&view=recent',
  shipments: '/manager/inbox?tab=deliveries&view=recent',
  messages: '/manager/inbox?tab=messages&view=recent',
  money: '/manager/performance?tab=money',
  reports: '/manager/performance',
  notes: '/manager/journal',
  activity: '/manager/journal?tab=activity',
  invitations: '/manager/settings#invitations',
};
