"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Trash2, Plus, Minus, ArrowRight, 
  ShoppingBag, ShieldCheck, Truck, Tag, 
  X, Loader2, CheckCircle2, ChevronLeft 
} from 'lucide-react';
import api from '@/services/api';

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon]  = useState(null); 
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Helper to safely modify global pending count
  const setPending = (delta) => {
    if (typeof window !== 'undefined') {
      window.__AURA_PENDING_CART = Math.max(0, (window.__AURA_PENDING_CART || 0) + delta);
    }
  };

  // Load real cart
  useEffect(() => {
    setLoading(true);
    api.get('/cart')
      .then(res => {
        if (res.data.success && res.data.data.cart?.items && (!window.__AURA_PENDING_CART)) {
          setCartItems(res.data.data.cart.items.map(item => ({
            id: item._id || (item.product?._id || item.product),
            productId: item.product?._id || item.product,
            name: item.product?.name || 'Product',
            price: item.product?.price || 0,
            quantity: item.quantity,
            image: item.product?.images?.[0]?.url || item.product?.images?.[0] || '',
            vendor_name: item.product?.vendor_id?.store_name || 'Vendor',
            vendor_id: item.product?.vendor_id?._id || item.product?.vendor_id || null,
          })));
        } else if (!res.data.data.cart?.items) {
          setCartItems([]);
        }
      })
      .catch(() => {
        if (!window.__AURA_PENDING_CART) setCartItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateCartQty = async (id, delta) => {
    setPending(1);
    setCartItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
    try {
      const res = await api.patch('/cart/item', { item_id: id, quantity_delta: delta });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) {
          window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
        }
      }
    } catch (err) {
      console.error('Failed updating cart item', err);
      setPending(-1);
    }
  };

  const removeCartItem = async (id) => {
    setPending(1);
    const prev = cartItems;
    setCartItems(prevItems => prevItems.filter(i => i.id !== id));
    try {
      const res = await api.delete('/cart/item', { data: { item_id: id } });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) {
          window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
        }
      }
    } catch (err) {
      console.error('Failed removing cart item', err);
      setPending(-1);
      if (window.__AURA_PENDING_CART === 0) setCartItems(prev);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await api.post('/coupons/apply', { code: couponCode.trim() });
      if (res.data.success) {
        setCoupon(res.data.data.coupon);
      } else {
        setCouponError(res.data.message || 'Invalid coupon code');
      }
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Could not apply coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => { setCoupon(null); setCouponCode(''); setCouponError(''); };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const delivery = 2500;
  const discount = coupon ? (coupon.type === 'percent' ? Math.round(subtotal * coupon.discount / 100) : coupon.discount) : 0;
  const total = subtotal + delivery - discount;

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
    </div>
  );

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-secondary)] text-[var(--text-primary)]">
        <div className="size-32 rounded-[40px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center mb-8 shadow-2xl">
          <ShoppingBag className="w-14 h-14 text-[var(--text-secondary)]/30" />
        </div>
        <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">Your stash is empty</h1>
        <p className="text-[var(--text-secondary)] mb-10 max-w-xs text-center font-medium">Capture premium assets to populate your Aura collection.</p>
            <Link href="/shop" className="px-12 py-4 bg-[var(--text-primary)] text-[var(--bg-primary)] font-black text-[10px] tracking-widest rounded-2xl hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl active:scale-95 uppercase">
               Start Infrastructure
            </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 overflow-x-hidden transition-colors duration-500">
      {/* Background Liquid Effects */}
      <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-[var(--accent-light)]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <main className="w-full px-6 lg:px-20 py-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
          <div>
            <Link href="/discovery" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-[10px] md:text-xs font-black tracking-widest mb-3 md:mb-4 uppercase">
              <ChevronLeft className="w-3.5 h-3.5" /> Continue Exploring
            </Link>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-none text-balance">
              Your <span className="text-[var(--accent)]">Stash</span>
            </h1>
          </div>
          <div className="px-4 md:px-5 py-2 glass-panel rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 flex items-center gap-2 md:gap-3 shadow-sm self-start md:self-auto">
             <span className="size-1.5 md:size-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <span className="text-[9px] md:text-xs font-black tracking-widest text-[var(--text-primary)] uppercase">{cartItems.length} Handpicked Items</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-6">
            {cartItems.map((item, idx) => (
              <div key={`${item.id || item.productId || item.name}-${idx}`} className="p-6 md:p-8 rounded-[48px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex flex-col sm:flex-row gap-8 hover:border-[var(--accent)]/30 transition-all duration-300 group glass-panel shadow-sm">
                <div className="w-full sm:w-40 h-40 rounded-3xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex-shrink-0 relative">
                  <img src={item.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                       <h3 className="text-2xl font-black text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent)] transition-colors">{item.name}</h3>
                       <div className="flex gap-2">
                         <Link href={`/chat?vendorId=${encodeURIComponent(item.vendor_id || '')}&productId=${encodeURIComponent(item.id || '')}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] shadow-sm" title="Message Vendor">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v7.5A2.25 2.25 0 0 1 19.5 16.5h-7.818a.75.75 0 0 0-.53.22l-3.53 3.53A.75.75 0 0 1 6 19.5v-3a.75.75 0 0 0-.75-.75H4.5A2.25 2.25 0 0 1 2.25 13.5v-7.5A2.25 2.25 0 0 1 4.5 3.75h15A2.25 2.25 0 0 1 21.75 6.75Z" />
                           </svg>
                         </Link>
                         <button onClick={() => removeCartItem(item.id)} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] shadow-sm hover:border-red-500/30"><Trash2 className="w-5 h-5" /></button>
                       </div>
                    </div>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] tracking-widest uppercase mb-6">Vendor: <span className="text-[var(--accent)]">{item.vendor_name}</span></p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-3xl font-black text-[var(--text-primary)] font-mono">${item.price.toLocaleString()}</span>
                    <div className="flex items-center gap-6 bg-[var(--bg-secondary)] p-2 px-5 rounded-2xl border border-[var(--glass-border)] shadow-inner">
                      <button onClick={() => updateCartQty(item.id, -1)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><Minus className="w-4 h-4" /></button>
                      <span className="font-black text-xl w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.id, 1)} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="p-8 rounded-[40px] bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center gap-6 shadow-inner">
              <div className="size-16 rounded-3xl bg-[var(--accent)] flex items-center justify-center text-white shadow-[0_0_30px_rgba(242,13,242,0.3)] flex-shrink-0 animate-pulse">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[var(--text-primary)] text-lg uppercase tracking-tight">Aura Escrow Protection</h4>
                <p className="text-sm text-[var(--text-secondary)] font-medium mt-1 leading-relaxed">Funds are released only when your premium physical assets are delivered and verified by our decentralized logistics node.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit">
            <div className="glass-panel p-8 lg:p-10 rounded-[48px] border border-[var(--glass-border)] shadow-3xl bg-[var(--bg-primary)]/80 backdrop-blur-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[var(--accent)]/20 transition-all duration-700"></div>
              
              <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">Summary</h2>
              
              <div className="space-y-6 mb-10">
                {coupon ? (
                  <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95 duration-300 shadow-sm">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                       <span className="font-black text-emerald-700 text-[10px] tracking-widest uppercase">Code {coupon.code} Active</span>
                    </div>
                    <button onClick={removeCoupon} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                         <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                         <input
                           value={couponCode}
                           onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                           onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                           placeholder="PROMO CODE"
                           className="w-full pl-11 pr-4 py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] font-black tracking-widest text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all uppercase shadow-inner"
                         />
                       </div>
                       <button
                         onClick={applyCoupon}
                         disabled={couponLoading || !couponCode.trim()}
                         className="px-6 py-4 bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-black rounded-xl text-[10px] tracking-widest disabled:opacity-50 transition-all uppercase shadow-sm"
                       >
                         {couponLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" /> : 'Apply'}
                       </button>
                    </div>
                    {couponError && <p className="text-[10px] font-black text-red-500 ml-1 tracking-tighter uppercase">{couponError}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between text-[var(--text-secondary)] text-[10px] font-black tracking-widest uppercase">
                  <span>Subtotal</span>
                  <span className="text-[var(--text-primary)] font-mono font-bold">${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)] text-[10px] font-black tracking-widest uppercase">
                  <span>Logistics</span>
                  <span className="text-[var(--text-primary)] font-mono font-bold">${delivery.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 text-[10px] font-black tracking-widest uppercase">
                    <span>Aura Discount</span>
                    <span className="font-mono font-bold">- ${discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="h-px bg-[var(--glass-border)] my-6" />
                <div className="flex justify-between items-baseline">
                   <span className="text-xs font-black text-[var(--text-secondary)] tracking-[0.2em] uppercase">Total Stash</span>
                   <span className="text-4xl font-black text-[var(--text-primary)] font-mono tracking-tighter">${total.toLocaleString()}</span>
                </div>
              </div>

              <Link 
                href="/checkout" 
                className="w-full py-5 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-black text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95 group mb-6"
              >
                Checkout Protocol <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <div className="flex items-center justify-center gap-6 py-4 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-2 text-[8px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                   <Truck className="w-3 h-3 text-[var(--accent)]" /> Aura Node
                </div>
                <div className="size-1 rounded-full bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-2 text-[8px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                   <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
