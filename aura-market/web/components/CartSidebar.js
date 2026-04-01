'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/services/api';
import { ArrowRight, Plus, Minus, Trash2, Package, ShoppingBag, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import cartStore from '@/services/cartStore';

export default function CartSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [items, setItems] = useState(cartStore.getItems());
  const [isOpen, setIsOpen] = useState(cartStore.getSidebarState());

  // Pages where the sidebar should NEVER appear in the side rail
  const hidden = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/chat', '/onboarding'];
  const isHiddenRoute = hidden.some(r => pathname?.startsWith(r));

  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems, isSidebarOpen }) => {
      setItems(newItems);
      setIsOpen(isSidebarOpen);
    });
    
    // Auto-open on mount IF there are items and not a hidden route
    if (items.length > 0 && !isHiddenRoute) {
      cartStore.toggleSidebar(true);
    }

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
  
  // Decide if we should render. We ALWAYS push content if it's "open"
  const visible = !isHiddenRoute && isOpen;

  return (
    <aside
      className={`
        hidden lg:flex flex-col
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
        border-l border-[var(--glass-border)]
        bg-[var(--bg-primary)]/80 backdrop-blur-3xl
        shrink-0 h-full relative z-[60]
        ${visible ? 'translate-x-0 w-[320px] opacity-100' : 'translate-x-full w-0 opacity-0'}
      `}
    >
      <div className="w-[320px] flex flex-col h-full overflow-hidden">
        {/* HEADER */}
        <div className="px-6 pt-8 pb-5 border-b border-[var(--glass-border)] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="size-9 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/30">
               <ShoppingBag className="w-4.5 h-4.5" />
             </div>
             <div>
               <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] leading-none">STASH</h2>
               <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-50 uppercase tracking-widest mt-1.5">{totalQty} ITEMS LOADED</p>
             </div>
          </div>
          <button onClick={() => cartStore.toggleSidebar(false)} className="size-8 rounded-full hover:bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 no-scrollbar">
          {items.map(it => (
            <div key={it.id || it.productId} className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 overflow-hidden shadow-sm">
                   {it.image ? <img src={it.image} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-auto opacity-10" />}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                   <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider leading-tight mb-1 truncate">{it.name}</h4>
                   <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase truncate">{it.vendor_name}</p>
                   <p className="text-[11px] font-black text-[var(--accent)] mt-2">{(it.price * it.quantity).toLocaleString()} XAF</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-[var(--bg-secondary)]/50 p-1.5 rounded-2xl border border-[var(--glass-border)]">
                 <div className="flex items-center gap-3">
                    <button onClick={() => updateQty(it.id, -1)} className="size-7 rounded-xl hover:bg-[var(--bg-primary)] border border-transparent hover:border-[var(--glass-border)] flex items-center justify-center transition-all">
                      <Minus className="size-3" />
                    </button>
                    <span className="text-[10px] font-black w-4 text-center">{it.quantity}</span>
                    <button onClick={() => updateQty(it.id, 1)} className="size-7 rounded-xl hover:bg-[var(--bg-primary)] border border-transparent hover:border-[var(--glass-border)] flex items-center justify-center transition-all">
                      <Plus className="size-3" />
                    </button>
                 </div>
                 <button onClick={() => removeItem(it.id)} className="text-[9px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-widest px-3">REMOVE</button>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-8 border-t border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-xl">
           <div className="flex justify-between items-end mb-6 px-1">
              <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.3em]">Estimated Total</span>
              <span className="text-xl font-black text-[var(--text-primary)] leading-none tracking-tighter">{subtotal.toLocaleString()} XAF</span>
           </div>
           <Link href="/checkout" className="w-full h-12 bg-[var(--accent)] text-white rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-3 hover:-translate-y-0.5 transition-all shadow-xl shadow-[var(--accent)]/20 active:scale-95 group">
             Checkout Pipeline <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
           </Link>
        </div>
      </div>
    </aside>
  );
}
