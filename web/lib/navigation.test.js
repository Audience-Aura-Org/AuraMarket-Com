import { describe, expect, it } from 'vitest';
import { normalizeAppRoute } from './navigation';
describe('notification navigation', () => {
  it('rejects executable and cross-origin links', () => {
    for (const route of ['javascript:alert(1)', 'data:text/html,test', '//evil.example/path', 'https://evil.example/pay']) expect(normalizeAppRoute(route, null)).toBeNull();
    expect(normalizeAppRoute(undefined, null)).toBeNull();
  });
  it('preserves local deep links and normalizes old role routes', () => {
    expect(normalizeAppRoute('/vendor/orders/123')).toBe('/vendor/orders?orderId=123');
    expect(normalizeAppRoute('/logistics/tracking/abc')).toBe('/logistics/manifests?shipmentId=abc');
    expect(normalizeAppRoute('/profile?tab=orders')).toBe('/profile?tab=orders');
    expect(normalizeAppRoute('https://auradime.com/orders/123')).toBe('/orders/123');
  });
});
