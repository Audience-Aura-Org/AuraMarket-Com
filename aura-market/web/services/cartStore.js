/**
 * services/cartStore.js
 * Restored to 2afc6a4 baseline functionality while maintaining side-rail state.
 */

import api from './api';

let _items = [];
let _raw = null;
let _subscribers = [];
let _fetchPromise = null;
let _sidebarOpen = true; // Still defaulting to true per separate user request

function parseItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(i => ({
    id: i._id || (i.product?._id || i.product),
    productId: i.product?._id || i.product,
    name: i.product?.name || 'Product',
    price: i.product?.price || 0,
    quantity: i.quantity || 1,
    image: i.product?.images?.[0]?.url || i.product?.images?.[0] || '',
    vendor_name: i.product?.vendor_id?.store_name || 'Vendor',
    vendor_id: i.product?.vendor_id?._id || i.product?.vendor_id || null,
    raw: i,
  }));
}

function notify() {
  const snapshot = { 
    items: _items, 
    count: _items.reduce((s, i) => s + i.quantity, 0),
    isSidebarOpen: _sidebarOpen
  };
  _subscribers.forEach(fn => fn(snapshot));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: _raw } }));
  }
}

export const cartStore = {
  subscribe(fn) {
    _subscribers.push(fn);
    fn({ items: _items, count: _items.reduce((s, i) => s + i.quantity, 0), isSidebarOpen: _sidebarOpen });
    return () => { _subscribers = _subscribers.filter(s => s !== fn); };
  },

  getItems() { return _items; },
  getCount() { return _items.reduce((s, i) => s + i.quantity, 0); },

  setCart(rawCart) {
    if (!rawCart) return;
    _raw = rawCart;
    _items = parseItems(rawCart.items || []);
    notify();
  },

  async refresh() {
    if (_fetchPromise) return _fetchPromise;
    
    // Check token
    let hasToken = false;
    if (typeof window !== 'undefined') {
       const stored = localStorage.getItem('aura-auth-storage');
       if (stored) {
         try { hasToken = !!JSON.parse(stored)?.state?.token; } catch(e){}
       }
       if (!hasToken) hasToken = !!localStorage.getItem('aura_token');
    }
    if (!hasToken) return;

    _fetchPromise = api.get('/cart')
      .then(res => {
        if (res.data?.success) {
          _raw = res.data.data.cart;
          _items = parseItems(_raw?.items || []);
          notify();
        }
      })
      .catch(() => {})
      .finally(() => { _fetchPromise = null; });
    return _fetchPromise;
  },

  toggleSidebar(force) {
    _sidebarOpen = force !== undefined ? force : !_sidebarOpen;
    notify();
  },

  getSidebarState() { return _sidebarOpen; }
};

export default cartStore;
