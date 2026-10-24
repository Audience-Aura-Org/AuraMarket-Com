const { calculateExpiry, activationDates, subscriptionReturnUrl } = require('../../utils/subscriptionDates');
it('clamps month-end and leap-year expiries without overflowing into another month', () => {
  expect(calculateExpiry('monthly', null, new Date('2026-01-31T12:00:00Z')).toISOString()).toBe('2026-02-28T12:00:00.000Z');
  expect(calculateExpiry('yearly', null, new Date('2024-02-29T12:00:00Z')).toISOString()).toBe('2025-02-28T12:00:00.000Z');
});
it('calculates a full duration from the supplied activation date', () => {
  const dates = activationDates({ startedAt: new Date('2027-01-01T00:00:00Z'), cycle: 'one_time', durationDays: 30 });
  expect(dates.expiry.toISOString()).toBe('2027-01-31T00:00:00.000Z');
});
it('rejects invalid or inverted dates instead of granting unlimited access', () => {
  expect(() => activationDates({ startedAt: new Date('invalid') })).toThrow(/valid date/);
  expect(() => activationDates({ startedAt: '2027-01-01', expiresAt: 'invalid' })).toThrow(/valid date/);
  expect(() => activationDates({ startedAt: '2027-01-02', expiresAt: '2027-01-01' })).toThrow(/after/);
});
it('keeps provider returns on the trusted verify page with the actual reference', () => {
  const url = new URL(subscriptionReturnUrl('https://auradime.com', 'https://attacker.test/steal', 'pawapay', 'REAL-REF'));
  expect(url.origin).toBe('https://auradime.com'); expect(url.pathname).toBe('/wallet/verify');
  expect(url.searchParams.get('ref')).toBe('REAL-REF');
  expect(new URL(subscriptionReturnUrl('https://auradime.com', 'https://auradime.com/wallet/verify?ref=OLD&role=vendor', 'payunit', 'NEW')).searchParams.get('ref')).toBe('NEW');
});
