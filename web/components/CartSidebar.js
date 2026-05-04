"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());
  const [deletingIds, setDeletingIds] = useState(new Set());
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(65);

  const hidden = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/onboarding'];
  const shouldHide = hidden.some(r => pathname?.startsWith(r));

  // Measure actual TopNav height so we position correctly
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector('header');
      if (nav) setNavHeight(nav.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);


  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems }) => {
      setItems(newItems);
    });
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
      if (res.data?.success) cartStore.setCart(res.data.data.cart);
    } catch {
      cartStore.refresh();
    } finally {
      cartStore.endMutation();
    }
  };

  const removeItem = async (itemId) => {
    // Prevent duplicate delete calls for the same item
    if (deletingIds.has(itemId)) return;

    setDeletingIds(prev => new Set([...prev, itemId]));
    cartStore.startMutation();
    const prev = cartStore.optimisticRemove(itemId);
    try {
      const res = await api.delete('/cart/item', { data: { item_id: itemId } });
      if (res.data?.success) cartStore.setCart(res.data.data.cart);
    } catch {
      cartStore.rollback(prev);
    } finally {
      cartStore.endMutation();
      setDeletingIds(current => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    }
  };

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const open = !shouldHide && items.length > 0;

  // Signal cart open state globally via HTML class for CSS grid adaptation
  useEffect(() => {
    document.documentElement.classList.toggle('cart-open', open);
    return () => document.documentElement.classList.remove('cart-open');
  }, [open]);

  return (
    <>
      {/* Width placeholder — reserves space in the flex layout to push content left */}
      <div
        className={`
          hidden lg:block flex-shrink-0
          transition-[width] duration-150 ease-out
          ${open ? 'w-[260px]' : 'w-0'}
        `}
        aria-hidden="true"
      />

      {/* Actual fixed sidebar — spans from bottom of TopNav to bottom of screen */}
      <aside
        style={{ top: `${navHeight}px` }}
        className={`
          hidden lg:flex flex-col
          fixed right-0 bottom-0
          w-[260px]
          border-l border-[var(--glass-border)]
          bg-[var(--bg-primary)]
          transition-transform duration-150 ease-out
          z-40
          ${open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
        `}
      >
        {/* ── HEADER ─────────────────────────── */}
        <div className="px-4 py-3 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black  tracking-[0.2em] text-[var(--accent)]">Stash</h3>
            <div className="flex items-center gap-1 bg-[var(--accent)]/10 px-2 py-0.5 rounded-full border border-[var(--accent)]/20">
              <span className="text-[9px] font-black text-[var(--accent)]">{totalQty}</span>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE ITEMS ──────────────── */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3 min-h-0">
          {items.map(it => {
            const itemId = it.id || it.productId;
            const isDeleting = deletingIds.has(itemId);
            return (
              <div
                key={itemId}
                className={`flex flex-col gap-2 border-b border-[var(--glass-border)] pb-3 last:border-0 last:pb-0 transition-opacity ${isDeleting ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="size-10 rounded-lg overflow-hidden border border-[var(--glass-border)] shrink-0">
                    <img src={it.image || null} className="size-full object-cover" alt={it.name} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black text-[var(--text-primary)] truncate leading-tight ">{it.name}</h4>
                    <span className="text-[9px] font-black text-[var(--accent)]">{(it.price * it.quantity).toLocaleString()} XAF</span>
                  </div>
                  {/* Remove */}
                  <button
                    onClick={() => removeItem(itemId)}
                    disabled={isDeleting}
                    className="size-6 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 transition-all shrink-0 flex items-center justify-center disabled:cursor-not-allowed"
                  >
                    {isDeleting
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Trash2 className="size-3.5" />
                    }
                  </button>
                </div>

                {/* Qty controls */}
                <div className="flex items-center">
                  <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg border border-[var(--glass-border)] p-0.5">
                    <button
                      onClick={() => updateQty(itemId, -1)}
                      className="size-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <Minus className="size-2.5" />
                    </button>
                    <span className="text-[9px] font-black px-2 text-[var(--text-primary)] min-w-[20px] text-center">{it.quantity}</span>
                    <button
                      onClick={() => updateQty(itemId, 1)}
                      className="size-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <Plus className="size-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER: ALWAYS AT BOTTOM ─────── */}
        <div className="shrink-0 px-4 py-4 border-t border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[0_-8px_32px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black tracking-wide text-[var(--text-secondary)] opacity-60">Subtotal</span>
            <span className="text-sm font-black text-[var(--text-primary)] tracking-tighter">{subtotal.toLocaleString()} XAF</span>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/checkout"
              className="w-full py-3 bg-[var(--accent)] text-white text-[10px] font-black tracking-wide rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center gap-2"
            >
              Checkout <ArrowRight className="size-3" />
            </Link>
            <Link
              href="/cart"
              className="w-full py-2.5 bg-white/5 border border-[var(--glass-border)] text-[var(--text-primary)] text-[9px] font-black tracking-wide rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
            >
              Full Cart View
            </Link>
            <Link
              href="/overtime"
              className="w-full py-2 bg-transparent text-[var(--text-secondary)] text-[8px] font-black tracking-wide hover:text-[var(--accent)] transition-all flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100"
            >
              <ArrowRight className="size-2.5 rotate-180" /> Continue Shopping
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
