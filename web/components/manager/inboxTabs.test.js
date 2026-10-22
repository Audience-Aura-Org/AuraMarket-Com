import { describe, it, expect } from 'vitest';
import { INBOX_TABS, tasksForTab, tabCounts, ageTone } from './inboxTabs';

const tasks = [
  { id: 1, type: 'order' },
  { id: 2, type: 'order' },
  { id: 3, type: 'shipment' },
  { id: 4, type: 'kyc' },
  { id: 5, type: 'dispute' },
];

describe('inbox tabs', () => {
  it('lists the five tabs in order', () => {
    expect(INBOX_TABS.map((t) => t.value)).toEqual(['all', 'orders', 'deliveries', 'messages', 'issues']);
  });

  it('maps issues to kyc and dispute tasks', () => {
    expect(tasksForTab(tasks, 'issues').map((t) => t.id)).toEqual([4, 5]);
  });

  it('maps deliveries to shipments', () => {
    expect(tasksForTab(tasks, 'deliveries').map((t) => t.id)).toEqual([3]);
  });

  it('counts every tab from one task list', () => {
    expect(tabCounts(tasks)).toEqual({ all: 5, orders: 2, deliveries: 1, messages: 0, issues: 2 });
  });

  it('unknown tab falls back to all', () => {
    expect(tasksForTab(tasks, 'nope')).toHaveLength(5);
  });
});

describe('ageTone', () => {
  const now = new Date('2026-10-21T12:00:00Z').getTime();
  const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString();

  it('ageTone is neutral ≤24h, warn >24h, bad >72h', () => {
    expect(ageTone(hoursAgo(2), now)).toBe('neutral');
    expect(ageTone(hoursAgo(24), now)).toBe('neutral');
    expect(ageTone(hoursAgo(25), now)).toBe('warn');
    expect(ageTone(hoursAgo(73), now)).toBe('bad');
  });
});
