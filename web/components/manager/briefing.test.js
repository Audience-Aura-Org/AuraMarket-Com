import { describe, it, expect } from 'vitest';
import { briefingHeadline, sortAccounts } from './briefing';

describe('briefingHeadline', () => {
  it('handles a manager with no accounts', () => {
    expect(briefingHeadline([])).toBe('No accounts yet');
  });
  it('says everything is on track when nothing needs attention', () => {
    expect(briefingHeadline([{ health: 'ok' }, { health: 'ok' }])).toBe('All accounts are on track');
  });
  it('uses the singular for one account', () => {
    expect(briefingHeadline([{ health: 'urgent' }, { health: 'ok' }])).toBe('1 account needs you today');
  });
  it('counts urgent and attention accounts', () => {
    expect(briefingHeadline([{ health: 'urgent' }, { health: 'attention' }, { health: 'ok' }]))
      .toBe('2 accounts need you today');
  });
});

describe('sortAccounts', () => {
  it('sortAccounts orders by health, then tasks desc, then name', () => {
    const sorted = sortAccounts([
      { id: 'ok-b', name: 'Bravo', health: 'ok', tasks: 0 },
      { id: 'att-1', name: 'Zulu', health: 'attention', tasks: 1 },
      { id: 'urg', name: 'Yankee', health: 'urgent', tasks: 2 },
      { id: 'att-5', name: 'Alpha', health: 'attention', tasks: 5 },
      { id: 'ok-a', name: 'Alpha', health: 'ok', tasks: 0 },
    ]);
    expect(sorted.map((a) => a.id)).toEqual(['urg', 'att-5', 'att-1', 'ok-a', 'ok-b']);
  });
  it('does not mutate its input', () => {
    const input = [{ id: '1', health: 'ok' }, { id: '2', health: 'urgent' }];
    sortAccounts(input);
    expect(input.map((a) => a.id)).toEqual(['1', '2']);
  });
});
