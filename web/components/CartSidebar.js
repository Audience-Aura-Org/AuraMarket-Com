"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';
import { formatVariantLabel } from '@/utils/variants';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [vendorMinimums, setVendorMinimums] = useState({});
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

  // Fetch minimum order amounts fresh (bypass 3-day offline cache)
  useEffect(() => {
    if (!items.length) return;
    const vendorIds = [...new Set(items.map(i => i.vendor_id).filter(Boolean))];
    if (!vendorIds.length) return;
    vendorIds.forEach(vid => {
      api.get(`/vendors/stores/${vid}`, { params: { nocache: '1' } })
        .then(res => {
          const min = Number(res.data?.data?.store?.minimum_order_amount) || 0;
          if (min > 0) setVendorMinimums(prev => ({ ...prev, [String(vid)]: min }));
        })
        .catch(() => {});
    });
  }, [items.length]);

  const vendorGroups = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const vid = String(item.vendor_id || 'unknown');
      if (!map.has(vid)) {
        const min = vendorMinimums[vid] || Number(item.vendor_minimum_order_amount) || 0;
        map.set(vid, { vendor_id: vid, vendor_name: item.vendor_name, subtotal: 0, minimum: min });
      }
      map.get(vid).subtotal += item.price * item.quantity;
    });
    return Array.from(map.values());
  }, [items, vendorMinimums]);

  const minimumErrors = vendorGroups.filter(g => g.minimum > 0 && g.subtotal < g.minimum);
  const hasMinimumErrors = minimumErrors.length > 0;

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
            <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] text-[var(--accent)]">Stash</h3>
            <div className="flex items-center gap-1 bg-[var(--accent)]/10 px-2 py-0.5 rounded-full border border-[var(--accent)]/20">
              <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)]">{totalQty}</span>
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
                    <h4 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] truncate leading-tight ">{it.name}</h4>
                    {it.variant && (
                      <p className="text-[9px] font-semibold text-[var(--accent)]/85 truncate leading-tight mt-0.5">
                        {formatVariantLabel(it.variant)}
                      </p>
                    )}
                    <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] font-mono">
                        {(it.price * it.quantity).toLocaleString()} XAF
                      </span>
                      {it.compare_at_price && Number(it.compare_at_price) > Number(it.price) && (
                        <span className="text-[9px] text-[var(--text-secondary)] line-through font-mono opacity-50">
                          {(Number(it.compare_at_price) * it.quantity).toLocaleString()} XAF
                        </span>
                      )}
                    </div>
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
                    <span className="text-[11px] lg:text-[12px]  font-semibold px-2 text-[var(--text-primary)] min-w-[20px] text-center">{it.quantity}</span>
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
            <span className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-60">Subtotal</span>
            <span className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">{subtotal.toLocaleString()} XAF</span>
          </div>

          {/* Per-vendor minimum order warnings */}
          {hasMinimumErrors && (
            <div className="mb-3 space-y-2">
              {minimumErrors.map(g => {
                const needed = g.minimum - g.subtotal;
                const pct = Math.min(100, Math.round((g.subtotal / g.minimum) * 100));
                return (
                  <div key={g.vendor_id} className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-2.5">
                    <div className="flex items-start gap-2 mb-1.5">
                      <AlertTriangle className="size-3 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-semibold text-amber-600 leading-tight">
                        {g.vendor_name} — add {needed.toLocaleString()} XAF more
                      </p>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {hasMinimumErrors ? (
              <Link
                href="/cart"
                className="w-full py-3 bg-amber-500/10 border border-amber-500/25 text-amber-600 text-[11px] lg:text-[12px] font-semibold tracking-tight rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <AlertTriangle className="size-3" /> View cart details
              </Link>
            ) : (
              <Link
                href="/checkout"
                className="w-full py-3 bg-[var(--accent)] text-white text-[11px] lg:text-[12px] font-semibold tracking-tight rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center gap-2"
              >
                Checkout <ArrowRight className="size-3" />
              </Link>
            )}
            <Link
              href="/cart"
              className="w-full py-2.5 bg-white/5 border border-[var(--glass-border)] text-[var(--text-primary)] text-[11px] lg:text-[12px] font-semibold tracking-tight rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
            >
              Full Cart View
            </Link>
            <Link
              href="/overtime"
              className="w-full py-2 bg-transparent text-[var(--text-secondary)] text-[11px] lg:text-[12px] font-semibold tracking-tight hover:text-[var(--accent)] transition-all flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100"
            >
              <ArrowRight className="size-2.5 rotate-180" /> Continue Shopping
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
