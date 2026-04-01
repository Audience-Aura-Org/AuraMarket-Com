"use client";

import { useState, useEffect } from 'react';
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
      {/* Background */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-[var(--accent-light)]/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Page header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-12 pt-6 pb-4 relative z-10">
        <Link href="/discovery" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-[10px] font-black tracking-widest mb-3 uppercase w-fit">
          <ChevronLeft className="w-3.5 h-3.5" /> Continue Exploring
        </Link>
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none">
            Your <span className="text-[var(--accent)]">Cart</span>
          </h1>
          <div className="px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur flex items-center gap-2 shadow-sm mb-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black tracking-wider text-[var(--text-primary)] uppercase">{cartItems.length} Items</span>
          </div>
        </div>
      </div>

      {/* Split layout — scrolls only inside */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden relative z-10 px-4 sm:px-6 lg:px-12 pb-4 sm:pb-6">

        {/* LEFT: Scrollable product list */}
        <div className="flex-1 lg:pr-6 overflow-y-auto no-scrollbar space-y-3 pb-4">
          {cartItems.map((item, idx) => (
            <div key={`${item.id || item.productId || item.name}-${idx}`} className="p-3 sm:p-4 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex gap-3 sm:gap-4 hover:border-[var(--accent)]/30 transition-all duration-300 group shadow-sm">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 relative">
                <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
              </div>
              <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                <div>
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent)] transition-colors line-clamp-2">{item.name}</h3>
                    <div className="flex gap-1.5 shrink-0">
                      <Link href={`/chat?vendorId=${encodeURIComponent(item.vendor_id || '')}&productId=${encodeURIComponent(item.id || '')}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors p-1.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--glass-border)]" title="Message vendor">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v7.5A2.25 2.25 0 0 1 19.5 16.5h-7.818a.75.75 0 0 0-.53.22l-3.53 3.53A.75.75 0 0 1 6 19.5v-3a.75.75 0 0 0-.75-.75H4.5A2.25 2.25 0 0 1 2.25 13.5v-7.5A2.25 2.25 0 0 1 4.5 3.75h15A2.25 2.25 0 0 1 21.75 6.75Z" /></svg>
                      </Link>
                      <button onClick={() => removeCartItem(item.id)} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-1.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--glass-border)] hover:border-red-500/30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-wide">Sold by <span className="text-[var(--accent)]">{item.vendor_name}</span></p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-mono">{item.price.toLocaleString()} XAF</span>
                  <div className="flex items-center gap-2.5 bg-[var(--bg-secondary)] p-1 px-2.5 rounded-xl border border-[var(--glass-border)]">
                    <button onClick={() => updateCartQty(item.id, -1)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="font-black text-sm w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.id, 1)} className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Escrow badge */}
          <div className="p-4 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center gap-4">
            <div className="size-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-[var(--text-primary)] text-sm">Escrow protection</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Payment released only after delivery is confirmed.</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Fixed order summary — never scrolls */}
        <div className="lg:w-[360px] xl:w-[400px] shrink-0 lg:overflow-y-auto no-scrollbar">
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-3xl p-5 sm:p-6 relative overflow-hidden shadow-2xl h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-lg font-black mb-5 uppercase tracking-tight">Order summary</h2>

              {/* Coupon */}
              <div className="mb-5">
                {coupon ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-black text-emerald-700 text-[10px] tracking-widest uppercase">Code {coupon.code} Active</span>
                    </div>
                    <button onClick={removeCoupon} className="text-[var(--text-secondary)] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        <input
                          value={couponCode}
                          onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                          onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                          placeholder="Promo code"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-semibold tracking-wide text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-all uppercase"
                        />
                      </div>
                      <button
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-black rounded-xl text-[10px] tracking-wider disabled:opacity-50 transition-all uppercase"
                      >
                        {couponLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" /> : 'Apply'}
                      </button>
                    </div>
                    {couponError && <p className="text-[10px] font-black text-red-500 tracking-tighter uppercase">{couponError}</p>}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-[var(--text-secondary)] text-[10px] font-semibold tracking-wide uppercase">
                  <span>Subtotal</span>
                  <span className="text-[var(--text-primary)] font-mono font-bold">{subtotal.toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)] text-[10px] font-semibold tracking-wide uppercase">
                  <span>Logistics</span>
                  <span className="font-mono font-bold opacity-40">Set at checkout</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 text-[10px] font-semibold tracking-wide uppercase">
                    <span>Discount</span>
                    <span className="font-mono font-bold">- {discount.toLocaleString()} XAF</span>
                  </div>
                )}
                <div className="h-px bg-[var(--glass-border)] my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-[var(--text-secondary)] tracking-[0.2em] uppercase">Total</span>
                  <span className="text-2xl font-black text-[var(--text-primary)] font-mono tracking-tight">{total.toLocaleString()} XAF</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="relative z-10 mt-auto">
              <Link
                href="/checkout"
                className="w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-black text-[10px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95 group mb-4"
              >
                Go to checkout <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <div className="flex items-center justify-center gap-5 pt-3 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                  <Truck className="w-3 h-3 text-[var(--accent)]" /> Aura Node
                </div>
                <div className="size-1 rounded-full bg-[var(--glass-border)]" />
                <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest text-[var(--text-secondary)] uppercase">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
