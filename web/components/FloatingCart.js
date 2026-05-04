"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, ArrowRight, Package } from 'lucide-react';
import { usePathname } from 'next/navigation';
import cartStore from '@/services/cartStore';
import { useAuthStore } from '@/hooks/useAuth';

export default function FloatingCart() {
  const { user } = useAuthStore();
  const [items, setItems] = useState(cartStore.getItems());
  const pathname = usePathname();

  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems }) => {
      setItems(newItems);
    });

    // Fetch on mount if user logged in
    if (user?._id) cartStore.refresh();

    return unsub;
  }, [user?._id]);

  // Do not show on auth, checkout, or cart pages themselves, or admin/vendor
  const hiddenRoutes = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/profile'];
  const shouldHide = hiddenRoutes.some(route => pathname?.startsWith(route));

  if (shouldHide) return null;
  if (items.length === 0) return null;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <>
      {/* Desktop Floating Cart (Right Edge) */}
      <div className="hidden md:flex fixed top-1/3 right-6 z-40 animate-fade-in group w-14 hover:w-[320px] transition-all duration-500 overflow-hidden shadow-2xl shadow-[var(--accent)]/10 will-change-transform rounded-[1.5rem]">
         <div className="w-full bg-[var(--bg-primary)]/95 backdrop-blur-2xl border border-[var(--glass-border)] rounded-[1.5rem] p-4 flex flex-col gap-4 min-h-[220px] max-h-[70vh]">
            
            {/* Expanded Header */}
            <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-[288px] mb-2 whitespace-nowrap">
               <h3 className="font-black text-[var(--text-primary)] text-sm tracking-widest ">Your Stack</h3>
               <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black px-2 py-0.5 rounded-full">{totalItems} ITEMS</span>
            </div>
            
            {/* Collapsed View */}
            <div className="flex flex-col items-center justify-center absolute top-5 left-1/2 -translate-x-1/2 group-hover:opacity-0 transition-opacity duration-300 pointer-events-none h-full">
               <div className="relative bg-[var(--bg-secondary)] p-2.5 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                 <ShoppingCart className="w-5 h-5 text-[var(--text-primary)]" />
                 <span className="absolute -top-1.5 -right-1.5 bg-[var(--accent)] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-[var(--bg-primary)] shadow-md">
                   {totalItems}
                 </span>
               </div>
               <div className="text-[9px] font-black  text-[var(--text-secondary)] mt-6 -rotate-90 tracking-[0.3em] whitespace-nowrap overflow-visible">
                 CART
               </div>
            </div>

            {/* Expanded Content List */}
            <div className="flex-1 overflow-y-auto w-[288px] no-scrollbar opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 min-h-0">
               <div className="space-y-4">
               {items.map((item, i) => (
                 <div key={item.id || i} className="flex items-center gap-3 pb-3 border-b border-[var(--glass-border)] last:border-0 last:pb-0">
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] overflow-hidden shrink-0 border border-[var(--glass-border)]">
                      {item.image ? (
                        <img src={item.image} className="w-full h-full object-cover" />
                      ) : <Package className="w-4 h-4 m-auto opacity-20" />}
                    </div>
                    <div className="min-w-0 flex-1 whitespace-nowrap overflow-hidden pr-2">
                      <p className="font-bold text-xs text-[var(--text-primary)] truncate">{item.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-black tracking-wide mt-0.5">QTY: {item.quantity}</p>
                    </div>
                    <div className="shrink-0 text-right">
                       <p className="text-sm font-black text-[var(--accent)]">{(item.price * item.quantity).toLocaleString()} XAF</p>
                    </div>
                 </div>
               ))}
               </div>
            </div>
            
            {/* Expanded Footer / Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150 pt-2 border-t border-[var(--glass-border)] w-[288px] shrink-0 bg-[var(--bg-primary)]/80 backdrop-blur-sm shadow-lg shadow-black/10 -mx-4 -mb-4 px-4 py-4">
               <div className="flex justify-between items-center mb-3 pr-2">
                 <span className="text-[10px] font-black  text-[var(--text-secondary)] tracking-widest">Estimated Total</span>
                 <span className="font-black text-lg text-[var(--text-primary)]">{totalPrice.toLocaleString()} XAF</span>
               </div>
               <div className="pr-2">
                 <Link href="/cart" className="w-full py-3 bg-[var(--accent)] text-white rounded-xl text-[10px] font-black tracking-widest  flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all shadow-lg shadow-[var(--accent)]/30 active:scale-95">
                   Proceed to Checkout <ArrowRight className="w-3 h-3" />
                 </Link>
               </div>
            </div>
         </div>
      </div>

      {/* Mobile Floating Cart (Bottom Edge above BottomNav) */}
      <div className="md:hidden fixed bottom-20 left-4 right-4 z-[40] animate-fade-in pointer-events-none">
        <div className="bg-[var(--bg-primary)]/90 backdrop-blur-2xl border border-[var(--glass-border)] rounded-[1.5rem] p-3 pl-4 flex flex-row items-center justify-between shadow-2xl shadow-[var(--text-primary)]/5 pointer-events-auto">
           <div className="flex items-center gap-4">
             <div className="relative flex-shrink-0">
               <ShoppingCart className="w-6 h-6 text-[var(--text-primary)]" />
               <span className="absolute -top-1.5 -right-1.5 bg-[var(--accent)] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-md border-[1.5px] border-[var(--bg-primary)]">
                 {totalItems}
               </span>
             </div>
             <div>
               <p className="text-[9px] font-black tracking-wide text-[var(--text-secondary)] leading-none mb-1">Subtotal</p>
               <p className="font-black text-sm text-[var(--text-primary)] leading-none">{totalPrice.toLocaleString()} XAF</p>
             </div>
           </div>
           
           <Link href="/cart" className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[14px] text-[10px] font-black tracking-widest  active:scale-95 transition-all shadow-md">
             View Cart
           </Link>
        </div>
      </div>
    </>
  );
}
