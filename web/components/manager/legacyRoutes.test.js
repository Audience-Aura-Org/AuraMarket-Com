import { describe, it, expect } from 'vitest';
import { LEGACY_ROUTES } from './legacyRoutes';
import { MANAGER_SECTIONS } from './shell/nav';

describe('LEGACY_ROUTES', () => {
  it('maps exactly the ten retired pages', () => {
    expect(LEGACY_ROUTES).toEqual({
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
    });
  });

  it('every target lands in one of the five sections', () => {
    for (const target of Object.values(LEGACY_ROUTES)) {
      const path = target.split(/[?#]/)[0];
      expect(MANAGER_SECTIONS.some((s) => s.match(path))).toBe(true);
    }
  });
});
