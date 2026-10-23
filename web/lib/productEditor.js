export const emptyProductForm = () => ({
  name: '', description: '', price: '', sale_price: '', stock: '', category: '',
  specifications: '', long_description: '',
});

export const productImageUrl = (image) => typeof image === 'string' ? image : image?.url || image?.location || '';

export function generateProductVariants(types, previous = [], defaults = {}) {
  const attributes = types.filter((type) => type.name.trim() && type.options.length);
  if (!attributes.length) return [];
  const names = attributes.map((type) => type.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) throw new Error('Use a different name for each attribute.');
  if (attributes.reduce((count, type) => count * type.options.length, 1) > 100) {
    throw new Error('Keep this product to 100 variants or fewer.');
  }
  let combinations = [{}];
  for (const type of attributes) {
    combinations = combinations.flatMap((combination) => type.options.map((option) => ({ ...combination, [type.name.trim()]: option })));
  }
  return combinations.map((combination) => {
    const matches = (variant, exact) => {
      const entries = Object.entries(variant.combination || {});
      return entries.length > 0 && (!exact || entries.length === Object.keys(combination).length) && entries.every(([key, value]) => combination[key] === value);
    };
    // Adding a new attribute expands a variant; carry its price and stock
    // into each new combination instead of replacing them with base defaults.
    const existing = previous.find((variant) => matches(variant, true)) || previous.find((variant) => matches(variant, false));
    return {
      ...existing, ...(existing && Object.keys(existing.combination).length !== Object.keys(combination).length ? { _id: undefined } : {}), combination,
      price: existing?.price ?? defaults.price ?? '',
      sale_price: existing ? existing.sale_price ?? '' : defaults.sale_price ?? '',
      stock: existing?.stock ?? defaults.stock ?? 0,
    };
  });
}

const validPrice = (value) => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0;
const validStock = (value) => value !== '' && value != null && Number.isInteger(Number(value)) && Number(value) >= 0;
const validSale = (sale, price) => sale === '' || sale == null || (validPrice(sale) && Number(sale) < Number(price));

export function validateProduct({ form, images, hasVariants, variantTypes, skuVariants }) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter a product name.';
  else if (form.name.trim().length > 150) errors.name = 'Use 150 characters or fewer.';
  if (!form.description.trim()) errors.description = 'Add a short description.';
  else if (form.description.length > 2000) errors.description = 'Use 2,000 characters or fewer.';
  if (!form.category.trim()) errors.category = 'Choose a category.';
  if (!images.length) errors.images = 'Add at least one product image.';
  if (images.length > 5) errors.images = 'Use up to five product images.';
  if (!hasVariants) {
    if (!validPrice(form.price)) errors.price = 'Enter a price greater than zero.';
    if (!validSale(form.sale_price, form.price)) errors.sale_price = 'Sale price must be positive and lower than the regular price.';
    if (!validStock(form.stock)) errors.stock = 'Enter a whole stock quantity of zero or more.';
  } else {
    const names = variantTypes.map((type) => type.name.trim().toLowerCase());
    if (!variantTypes.length || variantTypes.some((type) => !type.name.trim() || !type.options.length)) {
      errors.variants = 'Give every attribute a name and at least one option.';
    } else if (new Set(names).size !== names.length) {
      errors.variants = 'Use a different name for each attribute.';
    } else if (!skuVariants.length || skuVariants.length > 100) {
      errors.variants = 'Add between 1 and 100 variant combinations.';
    } else if (skuVariants.some((variant) => !validPrice(variant.price) || !validStock(variant.stock) || !validSale(variant.sale_price, variant.price))) {
      errors.variants = 'Every variant needs a valid price, whole stock quantity, and a sale price below its regular price.';
    }
  }
  return errors;
}

export function productFormData({ form, images, tags, parcelClass, hasVariants, variantTypes, skuVariants }) {
  const data = new FormData();
  const values = { ...form, name: form.name.trim(), description: form.description.trim() };
  if (hasVariants) {
    values.price = Math.min(...skuVariants.map((variant) => Number(variant.price)));
    values.stock = skuVariants.reduce((sum, variant) => sum + Number(variant.stock), 0);
    values.sale_price = '';
  }
  Object.entries(values).forEach(([key, value]) => data.append(key, value ?? ''));
  images.forEach((image) => data.append(image.existing ? 'existing_images' : 'images', image.existing ? image.url : image.file));
  data.append('tags', JSON.stringify(tags));
  data.append('type', 'products');
  data.append('parcel_class', parcelClass);
  data.append('has_variants', String(hasVariants));
  data.append('variant_types', JSON.stringify(hasVariants ? variantTypes.map((type) => ({ ...type, name: type.name.trim() })) : []));
  data.append('sku_variants', JSON.stringify(hasVariants ? skuVariants : []));
  return data;
}
