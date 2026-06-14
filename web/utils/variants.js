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

  let price;
  let compare_at_price;

  if (selectedVariant) {
    price = selectedVariant.price !== undefined && selectedVariant.price !== null ? Number(selectedVariant.price) : Number(product.price || 0);
    compare_at_price = selectedVariant.compare_at_price !== undefined && selectedVariant.compare_at_price !== null ? Number(selectedVariant.compare_at_price) : null;
  } else {
    price = Number(product.price || 0);
    compare_at_price = product.compare_at_price !== undefined && product.compare_at_price !== null ? Number(product.compare_at_price) : null;
  }

  return {
    price,
    compare_at_price,
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
