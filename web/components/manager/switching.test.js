import { describe, it, expect } from 'vitest';
import { resolveSwitchTarget, pickerSections } from './switching';

const accounts = [
  { id: 'A', name: 'Mama Ngozi Kitchen', email: 'ngozi@shop.cm', role: 'vendor', health: 'attention' },
  { id: 'B', name: 'Yaounde Tech', email: 'tech@shop.cm', role: 'vendor', health: 'ok' },
  { id: 'L', name: 'Douala Express', email: 'ops@dlx.cm', role: 'logistics', health: 'urgent' },
  { id: 'C', name: 'Brenda Customer', email: 'brenda@mail.cm', role: 'customer', health: 'ok' },
];

describe('resolveSwitchTarget', () => {
  const base = { actAsId: 'A', accounts };

  it('keeps the section when the target role has it', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/orders', accountId: 'B' }))
      .toBe('/manager/as/B/orders');
  });

  it('falls back to dashboard when the target role lacks it', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/products', accountId: 'L' }))
      .toBe('/manager/as/L/dashboard');
  });

  it('never carries detail pages over', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/products/edit', accountId: 'B' }))
      .toBe('/manager/as/B/products');
  });

  it('opens the dashboard when coming from the manager space', () => {
    expect(resolveSwitchTarget({ ...base, actAsId: null, pathname: '/manager/inbox', accountId: 'B' }))
      .toBe('/manager/as/B/dashboard');
  });

  it('is a no-op when selecting the active account', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/orders', accountId: 'A' })).toBeNull();
  });

  it('returns /manager for "All accounts"', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/orders', accountId: null })).toBe('/manager');
  });

  it('opens the dashboard for an account missing from the list', () => {
    expect(resolveSwitchTarget({ ...base, pathname: '/manager/as/A/orders', accountId: 'Z' }))
      .toBe('/manager/as/Z/dashboard');
  });
});

describe('pickerSections', () => {
  it('pickerSections drops starred/recent ids not in accounts', () => {
    const out = pickerSections({
      accounts,
      starred: [{ id: 'B', name: 'old name' }, { id: 'GONE', name: 'Revoked' }],
      recent: [{ id: 'GONE2' }, { id: 'L' }],
      query: '',
    });
    expect(out.starred.map((a) => a.id)).toEqual(['B']);
    expect(out.starred[0].name).toBe('Yaounde Tech'); // current data wins over persisted
    expect(out.recent.map((a) => a.id)).toEqual(['L']);
  });

  it('pickerSections filters by name and email, case-insensitive', () => {
    expect(pickerSections({ accounts, starred: [], recent: [], query: 'DOUALA' }).all.map((a) => a.id)).toEqual(['L']);
    expect(pickerSections({ accounts, starred: [], recent: [], query: 'mail.cm' }).all.map((a) => a.id)).toEqual(['C']);
  });

  it('pickerSections filters starred and recent by the query too', () => {
    const out = pickerSections({ accounts, starred: [{ id: 'B' }], recent: [{ id: 'A' }], query: 'ngozi' });
    expect(out.starred).toEqual([]);
    expect(out.recent.map((a) => a.id)).toEqual(['A']);
  });

  it('pickerSections orders all by health then name', () => {
    expect(pickerSections({ accounts, starred: [], recent: [], query: '' }).all.map((a) => a.id))
      .toEqual(['L', 'A', 'C', 'B']);
  });
});
