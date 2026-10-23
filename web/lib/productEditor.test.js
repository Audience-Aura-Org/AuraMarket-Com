import { describe, expect, it } from 'vitest';
import { emptyProductForm, generateProductVariants, productFormData, validateProduct } from './productEditor';

const valid = () => ({
  form: { ...emptyProductForm(), name: 'Canvas tote', description: 'Cotton canvas with reinforced handles.', category: 'Bags', price: '2500', sale_price: '2000', stock: '8' },
  images: [{ url: '/tote.png', existing: true }], tags: ['cotton'], parcelClass: 'small',
  hasVariants: false, variantTypes: [], skuVariants: [],
});

describe('product editor validation', () => {
  it('accepts zero stock but rejects fractional, negative, and non-finite quantities', () => {
    for (const stock of ['0', 0, '10']) expect(validateProduct({ ...valid(), form: { ...valid().form, stock } })).toEqual({});
    for (const stock of ['', '-1', '1.5', 'Infinity', 'no']) expect(validateProduct({ ...valid(), form: { ...valid().form, stock } })).toHaveProperty('stock');
  });
  it('rejects incomplete descriptions, invalid prices and invalid discounts before an upload', () => {
    const input = valid();
    input.form.description = '  ';
    input.form.price = 'Infinity';
    input.form.sale_price = '-5';
    input.images = [];
    expect(validateProduct(input)).toMatchObject({ description: expect.any(String), price: expect.any(String), sale_price: expect.any(String), images: expect.any(String) });
    expect(validateProduct({ ...valid(), form: { ...valid().form, sale_price: '2500' } })).toHaveProperty('sale_price');
  });
  it('requires real, priced variant combinations and checks each variant sale and stock', () => {
    const input = { ...valid(), hasVariants: true, variantTypes: [{ name: 'Size', options: ['S'] }] };
    expect(validateProduct(input)).toHaveProperty('variants');
    input.skuVariants = [{ combination: { Size: 'S' }, price: 100, sale_price: 101, stock: 0 }];
    expect(validateProduct(input)).toHaveProperty('variants');
    input.skuVariants[0].sale_price = '';
    expect(validateProduct(input)).toEqual({});
  });
});

describe('variant editing and upload payloads', () => {
  it('preserves existing variant identity, zero stock, and removed sale prices when adding an option', () => {
    const existing = { _id: 'sku-1', combination: { Size: 'S' }, price: 2500, sale_price: '', stock: 0 };
    const result = generateProductVariants([{ name: 'Size', options: ['S', 'M'] }], [existing], { stock: 8, price: 3000, sale_price: 2000 });
    expect(result[0]).toEqual(existing);
    expect(result[1]).toMatchObject({ combination: { Size: 'M' }, stock: 8, price: 3000 });
  });
  it('prevents runaway combinations and duplicate attribute names', () => {
    expect(() => generateProductVariants([{ name: 'Size', options: Array.from({ length: 101 }, (_, i) => String(i)) }])).toThrow(/100/);
    expect(() => generateProductVariants([{ name: 'Size', options: ['S'] }, { name: ' size ', options: ['M'] }])).toThrow(/different name/);
  });
  it('carries prices into new attribute combinations without reusing a SKU identity', () => {
    const result = generateProductVariants([
      { name: 'Color', options: ['Black'] }, { name: 'Size', options: ['S', 'M'] },
    ], [{ _id: 'old-sku', combination: { Color: 'Black' }, price: 3500, sale_price: null, stock: 0 }], { price: 1000, sale_price: 500, stock: 10 });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ price: 3500, sale_price: '', stock: 0 });
    expect(result[0]._id).toBeUndefined();
  });
  it('keeps retained images and uploaded files distinct and clears removed variant configuration', () => {
    const input = valid();
    const file = new File(['photo'], 'tote.png', { type: 'image/png' });
    input.images.push({ file, url: 'data:image/png;base64,photo' });
    const payload = productFormData(input);
    expect(payload.getAll('existing_images')).toEqual(['/tote.png']);
    expect(payload.get('images').name).toBe('tote.png');
    expect(payload.get('has_variants')).toBe('false');
    expect(payload.get('sku_variants')).toBe('[]');
  });
  it('derives a variable listing price and total stock from its variants', () => {
    const input = { ...valid(), hasVariants: true, variantTypes: [{ name: ' Size ', options: ['S', 'M'] }], skuVariants: [{ price: '3000', stock: '0' }, { price: '2000', stock: '4' }] };
    const payload = productFormData(input);
    expect(payload.get('price')).toBe('2000');
    expect(payload.get('stock')).toBe('4');
    expect(payload.get('sale_price')).toBe('');
    expect(JSON.parse(payload.get('variant_types'))[0].name).toBe('Size');
  });
});
