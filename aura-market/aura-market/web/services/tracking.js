import api from './api';

/**
 * services/tracking.js
 * Client-side tracking for user behavior personalization
 */
export const trackAction = async ({ 
  product_id, 
  action_type, 
  search_query, 
  category, 
  vendor_id,
  metadata 
}) => {
  try {
    // We use fire-and-forget for tracking so it doesn't block UI
    api.post('/track', {
      product_id,
      action_type,
      search_query,
      category,
      vendor_id,
      metadata
    }).catch(err => console.debug('Tracking failed silent', err));
  } catch (error) {
    // Silent fail
  }
};

export const trackView = (product) => {
  if (!product) return;
  trackAction({
    product_id: product._id || product.id,
    action_type: 'view',
    category: product.category,
    vendor_id: product.vendor_id?._id || product.vendor_id
  });
};

export const trackSearch = (query) => {
  if (!query) return;
  trackAction({
    action_type: 'search',
    search_query: query
  });
};

export const trackWishlist = (product) => {
  if (!product) return;
  trackAction({
    product_id: product._id || product.id,
    action_type: 'wishlist',
    category: product.category
  });
};

export const trackCart = (product) => {
  if (!product) return;
  trackAction({
    product_id: product._id || product.id,
    action_type: 'cart_add',
    category: product.category
  });
};
