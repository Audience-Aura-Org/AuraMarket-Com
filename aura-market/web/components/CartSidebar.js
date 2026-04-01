'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Package, ShoppingBag, X, ChevronRight, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());
  const [isOpen, setIsOpen] = useState(cartStore.getSidebarState());
  
  const prevCountRef = useRef(items.length);
  const hidden = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/chat', '/onboarding'];
  const isHiddenRoute = hidden.some(r => pathname?.startsWith(r));

  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems, isSidebarOpen }) => {
      if (newItems.length > prevCountRef.current && !isHiddenRoute) {
        cartStore.toggleSidebar(true);
      }
      prevCountRef.current = newItems.length;
      setItems(newItems);
      setIsOpen(isSidebarOpen);
    });
    if (user?._id && !isHiddenRoute) cartStore.refresh();
    return unsub;
  }, [user?._id, isHiddenRoute]);

  const updateQty = async (itemId, delta) => {
    cartStore.startMutation();
    cartStore.optimisticUpdateQty(itemId, delta);
    try {
      const res = await api.patch('/cart/item', { item_id: itemId, quantity_delta: delta });
      if (res.data?.success) cartStore.setCart(res.data.data.cart);
    } catch { cartStore.refresh(); }
    finally { cartStore.endMutation(); }
  };

  const removeItem = async (itemId) => {
    cartStore.startMutation();
    const prev = cartStore.optimisticRemove(itemId);
    try {
      const res = await api.delete('/cart/item', { data: { item_id: itemId } });
      if (res.data?.success) cartStore.setCart(res.data.data.cart);
    } catch { cartStore.rollback(prev); }
    finally { cartStore.endMutation(); }
  };

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const isVisible = !isHiddenRoute && isOpen;

  return (
    <aside
      id="cart-sidebar-rail"
      className={`
        hidden lg:flex flex-col
        transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
        border-l border-[var(--glass-border)] bg-[var(--bg-primary)]
        shrink-0 h-full relative z-[60]
        ${isVisible ? 'translate-x-0 w-[260px] opacity-100 shadow-2xl' : 'translate-x-full w-0 opacity-0 pointer-events-none'}
      `}
    >
      <div className="w-[260px] flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
        
        {/* REFINED HEADER (Legibility prioritized) */}
        <div className="px-5 pt-8 pb-5 border-b border-[var(--glass-border)] shrink-0 flex items-center justify-between text-[var(--text-primary)]">
          <div className="flex items-center gap-3">
             <div className="size-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/20">
               <ShoppingCart className="w-4 h-4" />
             </div>
             <div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.25em] leading-none mb-1.5">HUB STASH</h2>
               <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest leading-none">{items.length} ACTIVE ITEMS</p>
             </div>
          </div>
          <button onClick={() => cartStore.toggleSidebar(false)} className="size-8 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl hover:text-[var(--accent)] transition-all">
             <ChevronRight className="size-4" />
          </button>
        </div>

        {/* REFINED LEGIBILITY ITEMS */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar bg-transparent">
          {items.map(it => (
            <div key={it.id || it.productId} className="flex flex-col gap-3 group">
              <div className="flex items-start gap-3.5">
                <div className="size-11 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 overflow-hidden shadow-sm transition-transform group-hover:scale-105">
                   {it.image ? <img src={it.image} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-auto opacity-10" />}
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-tight leading-tight mb-1 truncate">{it.name}</h4>
                   <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] font-black text-[var(--accent)] tracking-tighter">{(it.price * it.quantity).toLocaleString()} <span className="text-[8px] opacity-40">XAF</span></p>
                      <button onClick={() => removeItem(it.id)} className="text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest px-2 transition-colors">REMOVE</button>
                   </div>
                </div>
              </div>
              <div className="grid grid-cols-3 items-center bg-[var(--bg-secondary)]/50 p-1 rounded-2xl border border-[var(--glass-border)] transition-colors group-hover:border-[var(--accent)]/10">
                 <button onClick={() => updateQty(it.id, -1)} className="size-6 rounded-xl hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all shadow-sm"><Minus className="size-3" /></button>
                 <span className="text-[10px] font-black text-center text-[var(--text-primary)]">{it.quantity}</span>
                 <button onClick={() => updateQty(it.id, 1)} className="size-6 rounded-xl hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all shadow-sm"><Plus className="size-3" /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-24 text-center flex flex-col items-center opacity-20">
               <ShoppingBag className="size-10 mb-5" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em]">Stash Neutral</p>
            </div>
          )}
        </div>

        {/* TERMINAL FOOTER (Restored Buttons) */}
        <div className="px-5 py-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-3xl shrink-0">
           <div className="flex justify-between items-end mb-6 px-1 text-[var(--text-primary)]">
              <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">TOTAL_MANIFEST</span>
              <span className="text-[16px] font-black tracking-tighter italic-none">{subtotal.toLocaleString()} XAF</span>
           </div>
           
           <div className="flex flex-col gap-3">
              <Link href="/checkout" className="w-full h-12 bg-[var(--accent)] text-white rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all shadow-xl shadow-[var(--accent)]/10 active:scale-95 group">
                CHECKOUT <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/cart" className="w-full h-11 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-sm">
                CART PAGE
              </Link>
           </div>
        </div>
      </div>
    </aside>
  );
}
