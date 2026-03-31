"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2, Package, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());

  // Pages where the sidebar should never appear
  const hidden = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/chat'];
  const shouldHide = hidden.some(r => pathname?.startsWith(r));

  useEffect(() => {
    // Subscribe to store updates
    const unsub = cartStore.subscribe(({ items: newItems }) => {
      setItems(newItems);
    });

    // Fetch fresh data on mount if user is logged in
    if (user?._id && !shouldHide) {
      cartStore.refresh();
    }

    return unsub;
  }, [user?._id, shouldHide]);

  const updateQty = async (itemId, delta) => {
    cartStore.startMutation();
    cartStore.optimisticUpdateQty(itemId, delta);
    try {
      const res = await api.patch('/cart/item', { item_id: itemId, quantity_delta: delta });
      if (res.data?.success) {
        cartStore.setCart(res.data.data.cart);
      }
    } catch {
      cartStore.refresh();
    } finally {
      cartStore.endMutation();
    }
  };

  const removeItem = async (itemId) => {
    cartStore.startMutation();
    const prev = cartStore.optimisticRemove(itemId);
    try {
      const res = await api.delete('/cart/item', { data: { item_id: itemId } });
      if (res.data?.success) {
        cartStore.setCart(res.data.data.cart);
      }
    } catch {
      cartStore.rollback(prev);
    } finally {
      cartStore.endMutation();
    }
  };

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const open = !shouldHide && items.length > 0;

  return (
    <aside
      className={`
        hidden lg:flex flex-col
        transition-all duration-300 ease-in-out overflow-hidden
        border-l border-[var(--glass-border)]
        bg-[var(--bg-primary)]/60 backdrop-blur-xl
        sticky top-[64px] self-start
        ${open ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-l-0'}
      `}
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Inner content — fixed width, full height, never scrolls itself */}
      <div className="w-[260px] flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Your Stash</h2>
            </div>
            <span className="text-[9px] font-black bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full">
              {totalQty} {totalQty === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Items list — ONLY this region scrolls */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar min-h-0">
          {items.map(it => (
            <div key={it.id || it.productId} className="flex items-center gap-3 group border-b border-[var(--glass-border)] pb-3 last:border-0 last:pb-0">
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 shadow-sm">
                {it.image
                  ? <img src={it.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  : <Package className="w-4 h-4 m-auto opacity-20" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-[var(--text-primary)] truncate leading-snug uppercase tracking-wider">{it.name}</p>
                <p className="text-[11px] font-black text-[var(--accent)] mt-0.5">{(it.price * it.quantity).toLocaleString()} XAF</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQty(it.id, -1)}
                  className="size-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors shadow-sm"
                >
                  <Minus className="w-2 h-2" />
                </button>
                <span className="text-[10px] font-black w-4 text-center text-[var(--text-primary)]">{it.quantity}</span>
                <button
                  onClick={() => updateQty(it.id, 1)}
                  className="size-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors shadow-sm"
                >
                  <Plus className="w-2 h-2" />
                </button>
                <button
                  onClick={() => removeItem(it.id)}
                  className="size-6 ml-0.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer / CTA */}
        <div className="px-4 pb-6 pt-4 border-t border-[var(--glass-border)] shrink-0 space-y-3">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Subtotal</span>
            <span className="text-base font-black text-[var(--text-primary)]">{subtotal.toLocaleString()} XAF</span>
          </div>

          {/* Buttons */}
          <Link
            href="/checkout"
            className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
          >
            Checkout <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/cart"
            className="w-full py-2.5 border border-[var(--glass-border)] rounded-xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-all"
          >
            Full Cart View
          </Link>
        </div>
      </div>
    </aside>
  );
}
