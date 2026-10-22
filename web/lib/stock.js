/**
 * One stock rule for vendor cards, filters and badges (mirrors the backend
 * analytics aggregation in vendor.controller getVendorAnalytics).
 *
 * - Meals (is_meal — the authoritative flag; `meal` is a default sub-object on
 *   every product) have no stock: available while active.
 * - Variant products: stock is the sum of their variants' stock (the
 *   top-level `stock` is not kept in sync with variants).
 */
export const LOW_STOCK_THRESHOLD = 5;

export const effectiveStock = (product = {}) => {
  const variants = product?.has_variants && Array.isArray(product.sku_variants) ? product.sku_variants : [];
  if (variants.length) return variants.reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
  return Number(product?.stock) || 0;
};

/** 'meal' | 'out' | 'low' | 'in' */
export const stockLevel = (product = {}) => {
  if (product?.is_meal === true) return product.status === 'active' ? 'meal' : 'out';
  const stock = effectiveStock(product);
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
};

export const isAvailable = (product) => ['meal', 'low', 'in'].includes(stockLevel(product));
