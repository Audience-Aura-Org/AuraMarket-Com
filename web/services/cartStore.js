/**
 * services/cartStore.js
 * Auradime — Centralized Cart State Manager
 *
 * A lightweight, event-driven cart store that acts as the single source
 * of truth for cart data across all components (TopNav, CartSidebar,
 * FloatingCart, CartPreview, ProductCard).
 *
 * Usage:
 *   cartStore.getItems()             → current parsed items array
 *   cartStore.getCount()             → total item quantity count
 *   cartStore.setCart(rawCartObj)    → parse & broadcast new cart state
 *   cartStore.clearCart()            → empty the cart & broadcast
 *   cartStore.refresh()              → fetch fresh cart from API
 *   cartStore.subscribe(fn)          → subscribe to changes, returns unsub fn
 */

import api from './api';

// ── Internal State ────────────────────────────────────────────────────────────

let _items = [];            // Parsed cart items
let _raw = null;            // Raw cart object from API
let _pendingOps = 0;        // Inflight mutation count (prevents stale overwrites)
let _subscribers = [];      // Listener callbacks
let _fetchPromise = null;   // Deduplicated fetch (avoid parallel GETs)
let _sidebarOpen = true;    // Default open on desktop per user preference

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    items: [..._items],   // always a new reference so React re-renders
    count: _items.reduce((s, i) => s + i.quantity, 0),
    isSidebarOpen: _sidebarOpen
  };
  _subscribers.forEach(fn => {
    try { fn(snapshot); } catch (e) { /* ignore subscriber errors */ }
  });

  // Also emit the legacy DOM event so old code still works during migration
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated', {
      detail: { cart: _raw }
    }));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const cartStore = {
  /**
   * Subscribe to cart state changes.
   * @param {function} fn  Called with { items, count } on every change.
   * @returns {function}   Call to unsubscribe.
   */
  subscribe(fn) {
    _subscribers.push(fn);
    // Call immediately with current state
    fn({ 
      items: _items, 
      count: _items.reduce((s, i) => s + i.quantity, 0),
      isSidebarOpen: _sidebarOpen
    });
    return () => {
      _subscribers = _subscribers.filter(s => s !== fn);
    };
  },

  getItems() {
    return _items;
  },

  getCount() {
    return _items.reduce((s, i) => s + i.quantity, 0);
  },

  /**
   * Ingest a raw cart object from any API response and broadcast updates.
   * Only applies changes if no mutations are pending (prevents race conditions).
   */
  setCart(rawCart) {
    if (!rawCart) return;
    
    // If mutations are still pending, don't overwrite state with server response
    // The final response when _pendingOps reaches 0 will update properly
    if (_pendingOps > 0) {
      _raw = rawCart;
      return;
    }
    
    _raw = rawCart;
    _items = parseItems(rawCart.items || []);
    notify();
  },

  /**
   * Clear the cart entirely (e.g. after order placement).
   */
  clearCart() {
    _raw = null;
    _items = [];
    _pendingOps = 0;
    notify();
  },

  /**
   * Fetch the latest cart from the server.
   * Deduplicates parallel calls.
   */
  async refresh() {
    if (_pendingOps > 0) return; // Don't overwrite during inflight mutations
    if (_fetchPromise) return _fetchPromise;

    // Guest protection: Don't fetch if no token exists to avoid 401 spam
    let hasToken = false;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('aura-auth-storage');
        const legacy = localStorage.getItem('aura_token');
        if (stored) {
           const parsed = JSON.parse(stored);
           hasToken = !!parsed?.state?.token;
        }
        if (!hasToken && legacy) hasToken = true;
      } catch (e) { /* ignore parse errors */ }
    }
    
    if (!hasToken) return;
    
    _fetchPromise = api.get('/cart')
      .then(res => {
        if (res.data?.success && _pendingOps === 0) {
          _raw = res.data.data.cart;
          _items = parseItems(_raw?.items || []);
          notify();
        }
      })
      .catch(() => {
        // Silent — unauthenticated or network error
      })
      .finally(() => {
        _fetchPromise = null;
      });

    return _fetchPromise;
  },

  // ── Mutation helpers ───────────────────────────────────────────────────────

  /**
   * Optimistically update item quantity in local state.
   */
  optimisticUpdateQty(itemId, delta) {
    _items = _items.map(it =>
      it.id === itemId
        ? { ...it, quantity: Math.max(1, it.quantity + delta) }
        : it
    );
    notify();
  },

  /**
   * Optimistically remove an item from local state.
   * Returns the previous state for rollback.
   */
  optimisticRemove(itemId) {
    const prev = _items;
    _items = _items.filter(i => i.id !== itemId);
    notify();
    return prev;
  },

  /**
   * Increment/decrement inflight mutation count.
   * While > 0, refresh() calls are skipped.
   */
  startMutation() {
    _pendingOps++;
    if (typeof window !== 'undefined') window.__AURA_PENDING_CART = _pendingOps;
  },

  endMutation() {
    _pendingOps = Math.max(0, _pendingOps - 1);
    if (typeof window !== 'undefined') window.__AURA_PENDING_CART = _pendingOps;
    
    // If all mutations are done and we have cached server state, apply it
    if (_pendingOps === 0 && _raw) {
      _items = parseItems(_raw.items || []);
      notify();
    }
  },

  rollback(prevItems) {
    _items = prevItems;
    notify();
  },

  /**
   * Optimistically add an item to the local cart state.
   * This provides the 'Liquid' feel before the server responds.
   */
  addItem(product, quantity = 1) {
    const newItem = {
      id: product._id || product.id,
      productId: product._id || product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0]?.url || product.images?.[0] || '',
      vendor_name: product.vendor_id?.store_name || 'Vendor',
      vendor_id: product.vendor_id?._id || product.vendor_id || null,
    };

    const existingIndex = _items.findIndex(it => it.id === newItem.id);
    if (existingIndex !== -1) {
      // Immutable update — new array + new item object
      _items = _items.map((it, i) =>
        i === existingIndex ? { ...it, quantity: it.quantity + quantity } : it
      );
    } else {
      _items = [..._items, newItem]; // new array reference
    }
    
    notify();
  },

  isPending() {
    return _pendingOps > 0;
  },
  
  toggleSidebar(force) {
    _sidebarOpen = force !== undefined ? force : !_sidebarOpen;
    notify();
  },
  
  getSidebarState() {
    return _sidebarOpen;
  }
};

export default cartStore;
