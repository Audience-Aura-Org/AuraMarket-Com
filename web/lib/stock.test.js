import { describe, it, expect } from 'vitest';
import { effectiveStock, stockLevel, isAvailable } from './stock';

describe('stock rule', () => {
  it('a retail product with the default meal sub-object is NOT a meal', () => {
    const p = { is_meal: false, meal: { spice_level: 'none' }, stock: 3, status: 'active' };
    expect(stockLevel(p)).toBe('low');
  });

  it('variant products use the sum of variant stock, not the top-level field', () => {
    const p = { has_variants: true, stock: 50, sku_variants: [{ stock: 1 }, { stock: 2 }] };
    expect(effectiveStock(p)).toBe(3);
    expect(stockLevel(p)).toBe('low');
  });

  it('sold-out variants make the product out of stock', () => {
    expect(stockLevel({ has_variants: true, stock: 9, sku_variants: [{ stock: 0 }, { stock: 0 }] })).toBe('out');
  });

  it.each([[0, 'out'], [-2, 'out'], [1, 'low'], [5, 'low'], [6, 'in']])('stock %i → %s', (stock, level) => {
    expect(stockLevel({ stock })).toBe(level);
  });

  it('meals have no stock: available while active', () => {
    expect(stockLevel({ is_meal: true, stock: 0, status: 'active' })).toBe('meal');
    expect(isAvailable({ is_meal: true, stock: 0, status: 'active' })).toBe(true);
    expect(isAvailable({ is_meal: true, status: 'inactive' })).toBe(false);
  });
});
