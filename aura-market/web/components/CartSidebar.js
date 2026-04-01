'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2, Package, ShoppingBag, X, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());
  const [isOpen, setIsOpen] = useState(cartStore.getSidebarState());
  
  // Track item count for auto-popping if minimized
  const prevCountRef = useRef(items.length);

  const hidden = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/chat', '/onboarding'];
  const isHiddenRoute = hidden.some(r => pathname?.startsWith(r));

  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems, isSidebarOpen }) => {
      // Re-trigger open if an item is added while it was minimized
      if (newItems.length > prevCountRef.current && !isHiddenRoute) {
        cartStore.toggleSidebar(true);
      }
      prevCountRef.current = newItems.length;
      setItems(newItems);
      setIsOpen(isSidebarOpen);
    });

    if (user?._id && !isHiddenRoute) {
      cartStore.refresh();
    }
    return unsub;
  }, [user?._id, isHiddenRoute]);

  const updateQty = async (itemId, delta) => {
    cartStore.startMutation();
    cartStore.optimisticUpdateQty(itemId, delta);
    try {
      const res = await api.patch('/cart/item', { item_id: itemId, quantity_delta: delta });
      if (res.data?.success) {
        cartStore.setCart(res.data.data.cart);
      }
    } catch { cartStore.refresh(); }
    finally { cartStore.endMutation(); }
  };

  const removeItem = async (itemId) => {
    cartStore.startMutation();
    const prev = cartStore.optimisticRemove(itemId);
    try {
      const res = await api.delete('/cart/item', { data: { item_id: itemId } });
      if (res.data?.success) {
        cartStore.setCart(res.data.data.cart);
      }
    } catch { cartStore.rollback(prev); }
    finally { cartStore.endMutation(); }
  };

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  
  const isVisible = !isHiddenRoute && isOpen;

  return (
    <aside
      className={`
        hidden lg:flex flex-col
        transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
        border-l border-[var(--glass-border)]
        bg-[var(--bg-primary)]/80 backdrop-blur-3xl
        shrink-0 h-full relative z-[60]
        ${isVisible ? 'translate-x-0 w-[280px] opacity-100' : 'translate-x-full w-0 opacity-0 pointer-events-none'}
      `}
    >
      <div className="w-[280px] flex flex-col h-full overflow-hidden">
        
        {/* ULTRA-COMPACT HEADER — "SENT INSIDE" TRIGGER */}
        <div className="px-4 pt-6 pb-4 border-b border-[var(--glass-border)] shrink-0 flex items-center justify-between bg-[var(--bg-primary)]/40">
          <div className="flex items-center gap-2">
             <div className="size-6 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/10">
               <ShoppingBag className="w-3 h-3" />
             </div>
             <div>
               <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] leading-none">STASH</h2>
               <p className="text-[7px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mt-1.5">{totalQty} NODES</p>
             </div>
          </div>
          <button 
             onClick={() => cartStore.toggleSidebar(false)} 
             className="flex items-center gap-1.5 pl-3 py-1 pr-1 border border-[var(--glass-border)] rounded-full hover:bg-[var(--bg-secondary)] transition-all group"
             title="Send Inside"
          >
             <span className="text-[7px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest group-hover:opacity-100">SEND INSIDE</span>
             <ChevronRight className="size-3 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* ULTRA-COMPACT ITEMS */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar bg-transparent">
          {items.map(it => (
            <div key={it.id || it.productId} className="flex flex-col gap-2 group border-b border-[var(--glass-border)]/20 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start gap-2.5">
                <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 overflow-hidden shadow-sm transition-transform group-hover:scale-105">
                   {it.image ? <img src={it.image} className="w-full h-full object-cover" /> : <Package className="w-3.5 h-3.5 m-auto opacity-10" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                   <h4 className="text-[9px] font-black text-[var(--text-primary)] uppercase tracking-tight leading-[1.1] mb-1 group-hover:text-[var(--accent)] transition-colors">{it.name}</h4>
                   <p className="text-[7px] font-black text-[var(--text-secondary)] opacity-30 uppercase truncate tracking-widest mb-1.5">{it.vendor_name || 'Node'}</p>
                   <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-[var(--accent)] tracking-tighter">{(it.price * it.quantity).toLocaleString()} <span className="opacity-40 text-[7px]">XAF</span></p>
                      <button onClick={() => removeItem(it.id)} className="text-[7px] font-black text-red-500/30 hover:text-red-500 uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100 px-1">DEL</button>
                   </div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-[var(--bg-secondary)]/30 p-1 rounded-xl border border-[var(--glass-border)]/40 shadow-inner">
                 <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(it.id, -1)} className="size-5 rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all opacity-40 hover:opacity-100 shadow-[var(--accent)]/5"><Minus className="size-2" /></button>
                    <span className="text-[9px] font-black w-4 text-center">{it.quantity}</span>
                    <button onClick={() => updateQty(it.id, 1)} className="size-5 rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all opacity-40 hover:opacity-100"><Plus className="size-2" /></button>
                 </div>
                 <span className="text-[8px] font-bold text-[var(--text-secondary)] opacity-30 px-2 uppercase">Quantity Protocol</span>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center opacity-30">
               <ShoppingBag className="size-8 mb-4 stroke-1" />
               <p className="text-[9px] font-black uppercase tracking-[0.2em]">Stash Deactivated</p>
            </div>
          )}
        </div>

        {/* ULTRA-COMPACT FOOTER */}
        <div className="px-4 py-6 border-t border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shrink-0">
           <div className="flex justify-between items-end mb-4 px-1">
              <span className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Payload Total</span>
              <span className="text-sm font-black text-[var(--text-primary)] leading-none tracking-tighter italic">{subtotal.toLocaleString()} XAF</span>
           </div>
           <Link href="/checkout" className="w-full h-11 bg-[var(--accent)] text-white rounded-2xl font-black text-[9px] tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all shadow-xl shadow-[var(--accent)]/10 active:scale-95 group">
             Checkout <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
           </Link>
           <Link href="/cart" className="w-full h-9 mt-2 border border-[var(--glass-border)] rounded-xl font-black text-[8px] tracking-widest uppercase flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all opacity-60 hover:opacity-100">
             Expand Terminal
           </Link>
        </div>
      </div>
    </aside>
  );
}
