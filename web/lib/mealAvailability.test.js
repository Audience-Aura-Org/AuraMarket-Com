import { describe, expect, it } from 'vitest';
import { isMealUnavailable } from './mealAvailability';

describe('isMealUnavailable', () => {
  it('treats meals without an explicit flag as available (same as the dine feed)', () => {
    expect(isMealUnavailable({ meal: {} })).toBe(false);
    expect(isMealUnavailable({})).toBe(false);
  });

  it('marks a meal switched off for today as unavailable', () => {
    expect(isMealUnavailable({ meal: { is_available_today: false } })).toBe(true);
  });

  it('keeps a meal that is off today but can be pre-ordered', () => {
    expect(isMealUnavailable({ meal: { is_available_today: false, booking_options: [{ type: 'pre_order' }] } })).toBe(false);
  });
});
