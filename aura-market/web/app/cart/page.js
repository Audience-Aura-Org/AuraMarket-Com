"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, 
  ChevronLeft, Package, Truck, CreditCard, Tag, RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import { trackAction } from '@/services/tracking';
import cartStore from '@/services/cartStore';

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);

  // Sync with central store
  useEffect(() => {
    const unsub = cartStore.subscribe(({ items: newItems }) => {
      setItems(newItems);
      setLoading(false);
    });
    cartStore.refresh();
    return unsub;
  }, []);

  const updateQuantity = async (itemId, delta) => {
    try {
      const response = await api.patch('/cart/item', { item_id: itemId, quantity_delta: delta });
      if (response.data.success) {
        cartStore.setCart(response.data.data.cart);
      }
    } catch (err) {
      console.error("Update failed:", err);
      cartStore.refresh();
    }
  };

  const removeItem = async (itemId) => {
    try {
      const response = await api.delete('/cart/item', { data: { item_id: itemId } });
      if (response.data.success) {
        cartStore.setCart(response.data.data.cart);
      }
    } catch (err) {
      console.error("Remove failed:", err);
      cartStore.refresh();
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const delivery = subtotal > 0 ? 1500 : 0;
  const total = subtotal + delivery - discount;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-[var(--accent)] animate-spin opacity-20" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] py-20 px-4">
        <div className="max-w-md mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
           <div className="size-24 rounded-full bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center mx-auto shadow-2xl">
             <ShoppingBag className="w-10 h-10 text-[var(--accent)]/30" />
           </div>
           <div className="space-y-3">
             <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter italic">Your Stash is Empty</h1>
             <p className="text-[11px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em]">Intercept products and add them to your protocol</p>
           </div>
           <Link 
             href="/shop" 
             className="inline-flex items-center gap-2 h-12 px-10 bg-[var(--accent)] text-white rounded-2xl font-black text-[10px] tracking-widest uppercase hover:translate-y-[-2px] transition-all shadow-xl shadow-[var(--accent)]/20 active:scale-95"
           >
             RETURN TO HUB <ArrowRight className="w-4 h-4" />
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-32">
      {/* Header Overlay */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 lg:px-12 py-6">
         <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => router.back()} className="size-10 rounded-xl hover:bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center transition-all">
                  <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
               </button>
               <div>
                  <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none italic">Cart Protocol</h1>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] mt-1">{items.length} ACTIVE NODES</p>
               </div>
            </div>
            <Link href="/shop" className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Continue Discovery</Link>
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ITEM LIST */}
        <div className="lg:col-span-8 space-y-4">
           {items.map((item) => (
             <div key={item.id} className="group flex flex-col sm:flex-row gap-6 p-5 rounded-3xl bg-[var(--bg-primary)]/80 backdrop-blur-xl border border-[var(--glass-border)] shadow-md hover:shadow-xl hover:border-[var(--accent)]/30 transition-all duration-500">
                {/* Thumb */}
                <div className="relative size-24 sm:size-32 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 shadow-inner">
                   {item.image ? (
                     <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                   ) : (
                     <Package className="w-8 h-8 m-auto opacity-10 text-[var(--text-primary)]" />
                   )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between py-1">
                   <div>
                      <div className="flex justify-between items-start mb-2">
                         <div className="space-y-1">
                            <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight line-clamp-1 group-hover:text-[var(--accent)] transition-colors italic">{item.name}</h3>
                            <p className="text-[10px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.15em] flex items-center gap-1.5">
                               <RefreshCw className="w-3 h-3 text-[var(--accent)]" /> {item.vendor_name || 'Verified Aura Node'}
                            </p>
                         </div>
                         <button onClick={() => removeItem(item.id)} className="text-red-500/30 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-500/5 shadow-sm">
                            <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                      <p className="text-sm font-black text-[var(--text-primary)]">{item.price.toLocaleString()} XAF</p>
                   </div>

                   <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-inner">
                         <button onClick={() => updateQuantity(item.id, -1)} className="size-10 rounded-xl hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all opacity-40 hover:opacity-100"><Minus className="w-4 h-4" /></button>
                         <span className="w-10 text-center font-black text-[var(--text-primary)]">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, 1)} className="size-10 rounded-xl hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all opacity-40 hover:opacity-100"><Plus className="w-4 h-4" /></button>
                      </div>
                      <p className="text-xl font-black text-[var(--accent)] italic">{(item.price * item.quantity).toLocaleString()} XAF</p>
                   </div>
                </div>
             </div>
           ))}
        </div>

        {/* SUMMARY STICKY */}
        <div className="lg:col-span-4 lg:sticky lg:top-32 space-y-6">
           <div className="rounded-3xl bg-[var(--bg-primary)]/80 backdrop-blur-3xl border border-[var(--accent)]/20 p-8 shadow-2xl relative overflow-hidden group">
              {/* Glow Accent */}
              <div className="absolute -top-24 -right-24 size-48 bg-[var(--accent)]/10 blur-[60px] rounded-full" />
              
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.3em] mb-8 border-b border-[var(--glass-border)] pb-4 flex items-center gap-2 italic">
                 <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Checkout
              </h2>

              <div className="space-y-6 mb-8">
                 <div className="flex justify-between items-center text-[11px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
                    <span>Subtotal Manifest</span>
                    <span className="text-[var(--text-primary)] font-mono">{subtotal.toLocaleString()} XAF</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
                    <span>Logistics Entry</span>
                    <span className="text-[var(--text-primary)] font-mono">{delivery.toLocaleString()} XAF</span>
                 </div>
                 {discount > 0 && (
                   <div className="flex justify-between items-center text-[11px] font-black text-emerald-500 uppercase tracking-widest">
                      <span>Spectral Discount</span>
                      <span className="font-mono">-{discount.toLocaleString()} XAF</span>
                   </div>
                 )}
                 <div className="pt-6 border-t border-[var(--glass-border)] flex justify-between items-end">
                    <div>
                       <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.25em] mb-1">Total Payload</p>
                       <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter italic">{total.toLocaleString()} XAF</p>
                    </div>
                 </div>
              </div>

              {/* Promo Input */}
              <div className="relative mb-8 group">
                 <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-30 group-focus-within:text-[var(--accent)] transition-all" />
                 <input 
                   type="text" 
                   placeholder="VOUCHER PROTOCOL"
                   className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl py-3.5 pl-11 pr-4 text-[10px] font-black tracking-widest uppercase outline-none focus:border-[var(--accent)]/40 transition-all placeholder:opacity-20 shadow-inner"
                   value={promoCode}
                   onChange={(e) => setPromoCode(e.target.value)}
                 />
              </div>

              <Link 
                href="/checkout"
                className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all shadow-2xl shadow-[var(--accent)]/20 active:scale-95 group"
              >
                PROCEED TO CHECKOUT <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
           </div>

           {/* Security Badges */}
           <div className="flex flex-col gap-4 px-2 italic">
              <div className="flex items-center gap-3 text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
                 <Truck className="w-4 h-4 text-[var(--accent)]" /> Global Freight Network
              </div>
              <div className="flex items-center gap-3 text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
                 <CreditCard className="w-4 h-4 text-emerald-500" /> End-to-End Encryption
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
