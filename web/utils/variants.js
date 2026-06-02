export function variantMatches(combination = {}, selected = {}) {
  const entries = Object.entries(selected || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return false;
  return entries.every(([key, value]) => String(combination?.[key] ?? '') === String(value));
}

export function findSelectedVariant(product = {}, selected = null) {
  if (!product?.has_variants || !selected) return null;
  return product.sku_variants?.find((variant) => variantMatches(variant.combination, selected)) || null;
}

export function applyVariantPricing(product = {}, selected = null) {
  const selectedVariant = findSelectedVariant(product, selected);
  const productImage = product.images?.[0]?.url || product.images?.[0] || null;

  return {
    price: selectedVariant?.price ?? product.price ?? 0,
    image: selectedVariant?.image || productImage,
    variant: selected || null,
    selectedVariant,
  };
}

export function formatVariantLabel(variant = null) {
  const entries = Object.entries(variant || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key}: ${value}`).join(' / ');
}
