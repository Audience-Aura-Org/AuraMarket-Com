import { describe, it, expect } from 'vitest';
import { restaurantHref } from './restaurantRoutes';
describe('restaurant navigation', () => {
  it('uses a packaged static route and encodes identifiers', () => expect(restaurantHref('a/b?x')).toBe('/dine/restaurant?vendor_id=a%2Fb%3Fx'));
  it('accepts populated vendor references', () => expect(restaurantHref({_id:'vendor'})).toBe('/dine/restaurant?vendor_id=vendor'));
  it('falls back to discovery without a vendor', () => expect(restaurantHref(null)).toBe('/dine'));
});
