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
    
    // Guest protection: Don't call if no token exists
    if (typeof window !== 'undefined') {
       const hasToken = !!localStorage.getItem('aura_token') || !!localStorage.getItem('aura-auth-storage');
       if (!hasToken) return;
    }

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
    <div className="absolute right-0 top-full mt-4 w-80 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] shadow-2xl p-4 transition-all duration-300 transform-gpu translate-y-2 z-50 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 backdrop-blur-xl">
      <h4 className="text-[10px] font-bold  tracking-[0.2em] mb-4 text-[var(--text-secondary)]">Cart Preview</h4>
      {loading ? (
        <div className="py-8 text-center text-[var(--text-secondary)] font-bold text-xs">Syncing nodes…</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-[var(--text-secondary)]">
          <div className="text-xs font-bold opacity-40 tracking-tight">Inventory Empty</div>
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
          {items.slice(0,8).map(it => (
            <div key={it.id || it.productId} className="flex items-center gap-3 group/item">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] group-hover/item:border-[var(--accent)]/30 transition-colors">
                {it.image ? <img src={it.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[var(--glass-border)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate text-[var(--text-primary)] tracking-tight">{it.name}</div>
                <div className="text-[10px] text-[var(--text-secondary)] font-bold mt-0.5 opacity-60 ">{it.quantity} × {it.price.toLocaleString()} XAF</div>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="pt-4 border-t border-[var(--glass-border)] mt-4 flex items-center justify-between">
            <div className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight">Subtotal</div>
            <div className="font-bold text-sm tracking-tighter">{subtotal.toLocaleString()} XAF</div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/cart" className="flex-1 px-4 py-3 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-[10px] text-center tracking-tight hover:border-[var(--text-primary)] transition-all">View Cart</Link>
            <Link href="/checkout" className="px-5 py-3 bg-[var(--accent)] text-white rounded-full font-bold text-[10px] flex items-center gap-2 tracking-tight shadow-lg shadow-[var(--accent)]/20 hover:scale-105 transition-all"><ArrowRight className="w-3.5 h-3.5" />Checkout</Link>
          </div>
        </div>
      )}
    </div>
  );
}
