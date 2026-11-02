import { describe, it, expect } from 'vitest';
import { getWorkspaceNav, getWorkspaceNavGroups } from './workspaceNav';

describe('manager workspace pages for restaurants', () => {
  it('gives a managed restaurant its kitchen and meals instead of products', () => {
    const slugs = getWorkspaceNav('vendor', { vendor_type: 'restaurant' }).map((n) => n.slug);
    expect(slugs.slice(0, 4)).toEqual(['dashboard', 'kitchen', 'meals', 'meals/add']);
    expect(slugs).toContain('orders');
    expect(slugs).not.toContain('products');
    const groups = getWorkspaceNavGroups('vendor', { vendor_type: 'restaurant' }).map((g) => g.label);
    expect(groups).toContain('Kitchen');
  });

  it('keeps the shop pages for other vendors', () => {
    const slugs = getWorkspaceNav('vendor', { vendor_type: 'retail' }).map((n) => n.slug);
    expect(slugs).toContain('products');
    expect(slugs).not.toContain('kitchen');
    expect(getWorkspaceNav('vendor').map((n) => n.slug)).toContain('products');
  });
});
