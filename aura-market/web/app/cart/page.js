"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trash2, Plus, Minus, ArrowRight, 
  ShoppingBag, ShieldCheck, Truck, Tag, 
  X, Loader2, CheckCircle2, ChevronLeft,
  Package
} from 'lucide-react';
import api from '@/services/api';

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon]  = useState(null); 
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const setPending = (delta) => {
    if (typeof window !== 'undefined') {
      window.__AURA_PENDING_CART = Math.max(0, (window.__AURA_PENDING_CART || 0) + delta);
    }
  };

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
      .catch(() => { if (!window.__AURA_PENDING_CART) setCartItems([]); })
      .finally(() => setLoading(false));
  }, []);

  const updateCartQty = async (id, delta) => {
    setPending(1);
    setCartItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
    try {
      const res = await api.patch('/cart/item', { item_id: id, quantity_delta: delta });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
      }
    } catch (err) { setPending(-1); }
  };

  const removeCartItem = async (id) => {
    setPending(1);
    const prev = cartItems;
    setCartItems(prevItems => prevItems.filter(i => i.id !== id));
    try {
      const res = await api.delete('/cart/item', { data: { item_id: id } });
      if (res.data?.success) {
        setPending(-1);
        if (window.__AURA_PENDING_CART === 0) window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: res.data.data.cart } }));
      }
    } catch (err) { setPending(-1); if (window.__AURA_PENDING_CART === 0) setCartItems(prev); }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponError('');
    try {
      const res = await api.post('/coupons/apply', { code: couponCode.trim() });
      if (res.data.success) setCoupon(res.data.data.coupon);
      else setCouponError(res.data.message || 'Invalid coupon code');
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Could not apply coupon');
    } finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setCoupon(null); setCouponCode(''); setCouponError(''); };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = coupon ? (coupon.type === 'percent' ? Math.round(subtotal * coupon.discount / 100) : coupon.discount) : 0;
  const total = subtotal - discount;

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
    </div>
  );

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-secondary)] text-[var(--text-primary)]">
        <div className="size-24 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center mb-6 shadow-lg">
          <ShoppingBag className="w-10 h-10 text-[var(--text-secondary)]/30" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">Your cart is empty</h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-xs text-center text-sm">Add products to continue to checkout.</p>
        <Link href="/shop" className="px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] font-black text-[10px] tracking-widest rounded-xl hover:bg-[var(--accent)] hover:text-white transition-all shadow-lg active:scale-95 uppercase">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] flex flex-col overflow-hidden transition-colors duration-500">
      {/* Background Decorations */}
      <div className="fixed top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 size-[400px] bg-[var(--accent-light)]/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* HEADER SECTION */}
      <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--bg-primary)]/80 backdrop-blur-md relative z-20">
        <div className="flex items-center gap-3">
          <Link href="/discovery" className="size-8 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] leading-none">ORDER STASH</h1>
            <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-1.5 leading-none">Aura Terminal / Cart V4.2</p>
          </div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-black tracking-[0.1em] text-emerald-600 uppercase">{cartItems.length} NODES LOADED</span>
        </div>
      </div>

      {/* SCROLLABLE BODY CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden relative z-10 px-4 sm:px-6 lg:px-12 pb-4 pt-4">
        
        {/* LEFT COLUMN: PRODUCT LIST */}
        <div className="flex-1 lg:pr-6 overflow-y-auto no-scrollbar space-y-3 pb-8">
          {cartItems.map((it, idx) => (
            <div key={`${it.id}-${idx}`} className="group flex items-center gap-4 p-3.5 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all shadow-sm">
              {/* Product Image */}
              <div className="size-14 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 flex items-center justify-center shadow-inner">
                {it.image ? <img src={it.image} className="w-full h-full object-cover" alt="" /> : <Package className="size-5 opacity-10" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0">
                    <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider truncate mb-1 leading-none">{it.name}</h3>
                    <p className="text-[7px] font-bold text-[var(--text-secondary)] opacity-40 uppercase truncate tracking-widest">{it.vendor_name || 'Aura Integrated Node'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-[var(--accent)] pl-3 tracking-tight">{(it.price * it.quantity).toLocaleString()} XAF</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/50 p-1 rounded-xl border border-[var(--glass-border)] shadow-inner">
                    <button onClick={() => updateCartQty(it.id, -1)} className="size-6 rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Minus className="size-2.5" /></button>
                    <span className="text-[9px] font-black w-4 text-center">{it.quantity}</span>
                    <button onClick={() => updateCartQty(it.id, 1)} className="size-6 rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Plus className="size-2.5" /></button>
                  </div>
                  
                  {/* Item Actions */}
                  <div className="flex items-center gap-3">
                    <Link 
                      href={`/chat?vendorId=${encodeURIComponent(it.vendor_id || '')}&productId=${encodeURIComponent(it.id || '')}`}
                      className="text-[8px] font-black text-[var(--text-secondary)] opacity-40 hover:text-[var(--accent)] hover:opacity-100 uppercase tracking-widest transition-all"
                    >
                      Message
                    </Link>
                    <button onClick={() => removeCartItem(it.id)} className="text-[8px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: ORDER SUMMARY SIDEBAR */}
        <div className="lg:w-[340px] xl:w-[380px] shrink-0 pt-0 lg:pt-0">
          <div className="bg-[var(--bg-primary)]/80 backdrop-blur-3xl border border-[var(--glass-border)] rounded-[2rem] p-6 lg:p-8 flex flex-col gap-5 shadow-2xl relative overflow-hidden h-fit">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
            
            <div className="mb-1">
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-[var(--accent)] mb-1.5 opacity-80">PRE-CHECKOUT MANIFEST</p>
              <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Order Summary</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-[var(--text-secondary)] opacity-50">Subtotal</span>
                <span className="text-[var(--text-primary)]">{subtotal.toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span className="text-[var(--text-secondary)] opacity-50">Logistic Fee</span>
                <span className="text-[var(--accent)] opacity-80">Calculated later</span>
              </div>
              
              <div className="pt-4 mt-2 border-t border-[var(--glass-border)]/60 flex justify-between items-end">
                <div>
                  <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em] mb-1.5">Net Amount</p>
                  <p className="text-2xl font-black text-[var(--text-primary)] leading-none tracking-tighter">{total.toLocaleString()} XAF</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="size-3 text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Link 
                href="/checkout" 
                className="w-full h-12 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-black text-[10px] tracking-[0.15em] uppercase flex items-center justify-center gap-3 hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl shadow-[var(--text-primary)]/5 active:scale-95 group"
              >
                Proceed to Checkout <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-[8px] text-center font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em] leading-relaxed">
                By clicking proceed, you agree to the <br/> Aura Market terms of service.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
