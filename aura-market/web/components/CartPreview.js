"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2 } from 'lucide-react';

export default function CartPreview() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to safely modify global pending count
  const setPending = (delta) => {
    if (typeof window !== 'undefined') {
      window.__AURA_PENDING_CART = Math.max(0, (window.__AURA_PENDING_CART || 0) + delta);
    }
  };

  const fetchCart = async (force = false) => {
    if (typeof window !== 'undefined' && window.__AURA_PENDING_CART > 0) return;
    try {
      const res = await api.get('/cart');
      if (res.data?.success && (!window.__AURA_PENDING_CART)) {
        setItems((res.data.data.cart?.items || []).map(i => ({
          id: i._id || (i.product?._id || i.product),
          productId: i.product?._id || i.product,
          name: i.product?.name || 'Product',
          price: i.product?.price || 0,
          quantity: i.quantity || 1,
          image: i.product?.images?.[0]?.url || i.product?.images?.[0] || '',
          vendor_name: i.product?.vendor_id?.store_name || '',
        })));
      }
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCart();
    const handleUpdate = (e) => {
      if (e.detail?.cart && (!window.__AURA_PENDING_CART)) {
        setItems((e.detail.cart.items || []).map(i => ({
          id: i._id || (i.product?._id || i.product),
          productId: i.product?._id || i.product,
          name: i.product?.name || 'Product',
          price: i.product?.price || 0,
          quantity: i.quantity || 1,
          image: i.product?.images?.[0]?.url || i.product?.images?.[0] || '',
          vendor_name: i.product?.vendor_id?.store_name || '',
        })));
      } else if (!e.detail?.cart) {
        fetchCart(true);
      }
    };
    window.addEventListener('cart-updated', handleUpdate);
    return () => window.removeEventListener('cart-updated', handleUpdate);
  }, []);

  const updateQty = async (id, delta) => {
    setPending(1);
    setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
    try {
      const res = await api.patch('/cart/item', { item_id: id, quantity_delta: delta });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) {
          window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
        }
      }
    } catch (err) {
      console.error('Failed to update cart item', err);
      setPending(-1);
    }
  };

  const removeItem = async (id) => {
    setPending(1);
    const prev = items;
    setItems(prevItems => prevItems.filter(i => i.id !== id));
    try {
      const res = await api.delete('/cart/item', { data: { item_id: id } });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) {
          window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
        }
      }
    } catch (err) {
      console.error('Failed to remove item', err);
      setPending(-1);
      if (window.__AURA_PENDING_CART === 0) setItems(prev);
    }
  };

  const subtotal = items.reduce((s, it) => s + (it.price * it.quantity), 0);

  return (
    <div className="absolute right-0 top-full mt-3 w-80 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl p-3 transition-all duration-200 transform-gpu translate-y-1 z-50 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-hover:translate-y-0">
      <h4 className="text-sm font-black mb-3">Cart Preview</h4>
      {loading ? (
        <div className="py-6 text-center text-[var(--text-secondary)]">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-[var(--text-secondary)]">Your cart is empty</div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {items.slice(0,6).map(it => (
            <div key={it.id || it.productId} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                {it.image ? <img src={it.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[var(--glass-border)]" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-black truncate">{it.name}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">{it.quantity} × ${it.price.toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(it.id, -1)} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)]"><Minus className="w-3 h-3" /></button>
                <button onClick={() => updateQty(it.id, 1)} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)]"><Plus className="w-3 h-3" /></button>
                <button onClick={() => removeItem(it.id)} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-[var(--glass-border)] mt-2 flex items-center justify-between">
            <div className="text-[10px] text-[var(--text-secondary)] font-black">Subtotal</div>
            <div className="font-black">${subtotal.toLocaleString()}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/cart" className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-black text-sm text-center">View Cart</Link>
            <Link href="/checkout" className="px-3 py-2 bg-[var(--accent)] text-white rounded-xl font-black text-sm flex items-center gap-2"><ArrowRight className="w-4 h-4" />Checkout</Link>
          </div>
        </div>
      )}
    </div>
  );
}
