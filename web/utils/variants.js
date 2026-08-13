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
  // images[0] may be a string URL (legacy) or an object { url, public_id }.
  // Never fall through to the raw object — always extract a string or null.
  const rawImg = product.images?.[0];
  const productImage = (typeof rawImg === 'string' ? rawImg : rawImg?.url) || null;

  let price;
  let compare_at_price;
  let sale_price;

  if (selectedVariant) {
    const regularPrice = selectedVariant.price !== undefined && selectedVariant.price !== null ? Number(selectedVariant.price) : Number(product.price || 0);
    const variantSalePrice = selectedVariant.sale_price !== undefined && selectedVariant.sale_price !== null ? Number(selectedVariant.sale_price) : null;
    
    if (variantSalePrice && variantSalePrice > 0 && variantSalePrice < regularPrice) {
      price = variantSalePrice;
      compare_at_price = regularPrice;
      sale_price = variantSalePrice;
    } else {
      price = regularPrice;
      compare_at_price = null;
      sale_price = null;
    }
  } else {
    const regularPrice = Number(product.price || 0);
    const productSalePrice = product.sale_price !== undefined && product.sale_price !== null ? Number(product.sale_price) : null;
    
    if (productSalePrice && productSalePrice > 0 && productSalePrice < regularPrice) {
      price = productSalePrice;
      compare_at_price = regularPrice;
      sale_price = productSalePrice;
    } else {
      price = regularPrice;
      compare_at_price = null;
      sale_price = null;
    }
  }

  return {
    price,
    compare_at_price,
    sale_price,
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
