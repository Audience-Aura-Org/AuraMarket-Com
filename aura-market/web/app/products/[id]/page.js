"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Star,
  ShoppingBag, Zap, Plus, Minus, Loader2, CheckCircle2,
  ChevronRight, Truck, Shield, RefreshCw, Package,
  AlertCircle, Award, Store
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { trackView, trackCart } from '@/services/tracking';
import ProductCard from '@/components/ProductCard';
import cartStore from '@/services/cartStore';
import { toast as hotToast } from 'react-hot-toast';

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const imgRef = useRef(null);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          setProduct(res.data.data.product);
          api.post(`/products/${id}/view`).catch(() => {});
          trackView(res.data.data.product);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    api.get(`/reviews/product/${id}`).then(r => setReviews(r.data.data?.reviews || [])).catch(() => {});
    api.get(`/products/${id}/related?limit=10`).then(r => setRelated(r.data.data?.products || [])).catch(() => {});
  }, [id]);

  const handleWishlist = async () => {
    if (!user) return router.push('/login');
    try {
      const res = await api.post('/wishlist/toggle', { product_id: id });
      const next = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(next);
      hotToast.success(next ? 'Added to wishlist' : 'Removed from wishlist');
    } catch { hotToast.error('Failed to update wishlist'); }
  };

  const handleAddToCart = async () => {
    if (!user) return router.push('/login');
    setAddingToCart(true);
    trackCart(product);
    cartStore.addItem(product, quantity);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-item-added', {
        detail: { name: product.name, image: product.images?.[0]?.url || product.images?.[0] }
      }));
    }
    try {
      const res = await api.post('/cart', { product_id: id, quantity });
      cartStore.setCart(res.data.data.cart);
      hotToast.success('Added to cart');
    } catch {
      hotToast.error('Cart update failed');
      cartStore.refresh();
    } finally { setAddingToCart(false); }
  };

  const handleBuyNow = async () => {
    if (!user) return router.push('/login');
    if (!product.vendor_id) return;
    setBuyingNow(true);
    try {
      trackCart(product);
      cartStore.addItem(product, quantity);
      await api.post('/cart', { product_id: id, quantity }).catch(() => {});
      router.push('/checkout');
    } catch { hotToast.error('Checkout failed'); }
    finally { setBuyingNow(false); }
  };

  const handleChat = () => {
    if (!user) return router.push('/login');
    const vId = vendor?.user_id?._id || vendor?.user_id || vendor?._id;
    if (!vId) return hotToast.error('Unable to reach seller.');
    router.push(`/messages?vendorId=${vId}&productId=${id}`);
  };

  const handleMouseMove = (e) => {
    if (!isZoomed || !imgRef.current) return;
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    imgRef.current.style.transformOrigin = `${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="relative size-10">
        <div className="absolute inset-0 border-2 border-[var(--glass-border)] rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-secondary)] gap-4">
      <AlertCircle className="size-10 text-[var(--text-secondary)]" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">Product not found</p>
      <button onClick={() => router.push('/shop')}
        className="px-6 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[var(--accent)] rounded-full hover:opacity-90 transition-all">
        Back to Shop
      </button>
    </div>
  );

  const images = product?.images?.length ? product.images : [{ url: '/placeholder.png' }];
  const vendor = product?.vendor_id;
  const inStock = Boolean(product?.stock > 0);
  const rating = Number(product?.rating || 0);
  const discount = product?.oldPrice
    ? Math.round(100 - (product.price / product.oldPrice) * 100)
    : null;

  // Detect if the logged-in user is the vendor who listed this product
  const vendorUserId = vendor?.user_id?._id?.toString() || vendor?.user_id?.toString();
  const isOwnProduct = Boolean(user && vendorUserId && user._id?.toString() === vendorUserId);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">

      {/* ── Editorial Nav Bar ── */}
      <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)]/80 backdrop-blur-2xl border-b border-black/[0.03] dark:border-white/[0.03]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-12 h-14 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
            <ArrowLeft className="size-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Return</span>
          </button>

          <div className="flex items-center gap-4">
            <button onClick={handleWishlist}
              className={`size-10 rounded-full flex items-center justify-center transition-all ${wishlisted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            <button className="size-10 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-secondary)]/80 transition-all">
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Layout ── */}
      <div className="w-full px-4 md:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Col 1: Media Gallery ── */}
        <div className="lg:col-span-5 xl:col-span-5 flex gap-8">
          {/* Main Stage */}
          <div className="flex-1 flex flex-col gap-6">
            <div
              className="relative w-full aspect-[4/5] bg-white rounded-[40px] overflow-hidden cursor-zoom-in shadow-[0_60px_100px_-20px_rgba(0,0,0,0.05)] group"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => { setIsZoomed(false); if (imgRef.current) imgRef.current.style.transformOrigin = 'center'; }}
              onMouseMove={handleMouseMove}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImg}
                  ref={imgRef}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: isZoomed ? 1.5 : 1 }}
                  src={images[activeImg]?.url || images[activeImg]}
                  alt={product.name}
                  className="w-full h-full object-contain p-8 md:p-16 transition-transform duration-500 ease-out"
                />
              </AnimatePresence>
            </div>
            
            {/* Horizontal Thumbnails (Mobile & Tablet) */}
            <div className="flex md:hidden gap-3 overflow-x-auto no-scrollbar pb-2">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`size-20 rounded-2xl overflow-hidden bg-white shrink-0 transition-all ${activeImg === i ? 'ring-2 ring-black scale-95' : 'opacity-40'}`}>
                  <img src={img.url || img} className="w-full h-full object-contain p-2" alt="" />
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Sidebar Thumbnails */}
          <div className="hidden md:flex flex-col gap-4 order-1 shrink-0 w-20">
            {images.map((img, i) => (
              <button 
                key={i} 
                onClick={() => setActiveImg(i)}
                className={`aspect-square rounded-2xl overflow-hidden bg-white shadow-sm border border-black/5 transition-all duration-500 scale-100 hover:scale-[1.03] ${activeImg === i ? 'ring-2 ring-black bg-white ring-offset-2 opacity-100' : 'opacity-20 hover:opacity-100'}`}
              >
                <img src={img.url || img} className="w-full h-full object-contain p-3" alt="" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Col 2: Product Info ── */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-10">
          
          {/* Editorial Product Info */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-[var(--bg-secondary)] rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Official Listing</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{product.category}</span>
              </div>
              <h1 className="text-[2.5rem] md:text-[3.5rem] font-[900] leading-[0.95] tracking-[-0.04em] text-[var(--text-primary)]">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-5xl font-[900] tracking-tighter">
                  {product.price?.toLocaleString()}
                </span>
                <span className="text-sm font-black text-[var(--accent)] uppercase tracking-widest">XAF</span>
              </div>
              {product.oldPrice && (
                <div className="flex items-center gap-2 opacity-50">
                  <span className="text-sm line-through decoration-red-500/30">{product.oldPrice?.toLocaleString()} XAF</span>
                  <span className="text-[10px] font-black uppercase text-red-500">-{discount}%</span>
                </div>
              )}
            </div>

            {/* Unified Action Panel */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-[40px] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] border border-black/[0.02] dark:border-white/[0.02] space-y-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Select Quantity</span>
                <div className="flex items-center gap-6 bg-[var(--bg-secondary)] px-5 py-2.5 rounded-full">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="hover:text-[var(--accent)] active:scale-75 transition-all"><Minus className="size-4" /></button>
                  <span className="text-sm font-black w-4 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="hover:text-[var(--accent)] active:scale-75 transition-all"><Plus className="size-4" /></button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleBuyNow}
                  disabled={buyingNow || !inStock}
                  className="w-full h-16 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:shadow-black/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3"
                >
                  {buyingNow ? <Loader2 className="size-5 animate-spin" /> : <Zap className="size-4 fill-current" />}
                  Finalize Purchase
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !inStock}
                  className="w-full h-16 bg-[var(--bg-secondary)] rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-[var(--bg-secondary)]/70 transition-all flex items-center justify-center gap-3"
                >
                  {addingToCart ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-4" />}
                  Add to Collection
                </button>
              </div>

              {!inStock && <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-500">Sold Out In Store</p>}
            </div>

            {/* Minimal Seller Identity */}
            {vendor && (
              <div className="flex items-center gap-5 p-6 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[32px] border border-black/[0.05] dark:border-white/[0.05] group cursor-pointer hover:border-[var(--accent)]/30 transition-all" onClick={() => router.push(`/stores/${vendor._id}`)}>
                <div className="size-14 rounded-2xl overflow-hidden bg-white shadow-xl rotate-[-3deg] group-hover:rotate-0 transition-transform duration-500">
                  <img src={vendor.user_id?.branding?.logo || vendor.user_id?.avatar} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-tight">{vendor.store_name}</span>
                    {vendor.verified && <CheckCircle2 className="size-3.5 text-[var(--accent)]" />}
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">Premium Merchant · 4.9 Rating</span>
                </div>
                <ChevronRight className="size-5 text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </div>
        </div>

        {/* Technical Specification Strip */}
        <div className="hidden xl:block xl:col-span-12 mt-12">
          <div className="grid grid-cols-4 gap-8 p-12 bg-white rounded-[40px] shadow-sm">
            {[
              { icon: Shield, label: 'Condition', val: product.condition || 'Mint' },
              { icon: Award, label: 'Quality', val: 'Verified Artisan' },
              { icon: RefreshCw, label: 'Returns', val: '7-Day Policy' },
              { icon: Truck, label: 'Logistics', val: 'Global Express' }
        {/* ── Col 3: Buy Console + Seller Identity ── */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="lg:sticky lg:top-[120px] flex flex-col gap-6">
            {/* Action Card */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-[40px] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] border border-black/[0.02] dark:border-white/[0.02] space-y-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Selection</span>
                <div className="flex items-center gap-6 bg-[var(--bg-secondary)] px-5 py-2.5 rounded-full">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="hover:text-[var(--accent)] active:scale-75 transition-all"><Minus className="size-4" /></button>
                  <span className="text-sm font-black w-4 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="hover:text-[var(--accent)] active:scale-75 transition-all"><Plus className="size-4" /></button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleBuyNow}
                  disabled={buyingNow || !inStock}
                  className="w-full h-16 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:shadow-black/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3"
                >
                  {buyingNow ? <Loader2 className="size-5 animate-spin" /> : <Zap className="size-4 fill-current" />}
                  Purchase
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !inStock}
                  className="w-full h-16 bg-[var(--bg-secondary)] rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-[var(--bg-secondary)]/70 transition-all flex items-center justify-center gap-3"
                >
                  {addingToCart ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-4" />}
                  Add to Bag
                </button>
              </div>
            </div>

            {/* Merchant Identity */}
            {vendor && (
              <div className="flex flex-col gap-4 p-8 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[40px] border border-black/[0.05] dark:border-white/[0.05] group">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl overflow-hidden bg-white shadow-lg rotate-[-3deg] group-hover:rotate-0 transition-transform">
                    <img src={vendor.user_id?.branding?.logo || vendor.user_id?.avatar} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-tight">{vendor.store_name}</span>
                    <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest">Verified Boutique</span>
                  </div>
                </div>
                <button 
                  onClick={() => router.push(`/stores/${vendor._id}`)}
                  className="w-full py-3 border border-black/[0.1] rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all"
                >
                  Visit Official Store
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Technical Specification Strip (Full Width Bottom) */}
        <div className="lg:col-span-12 mt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-12 bg-white rounded-[40px] shadow-sm">
            {[
              { icon: Shield, label: 'Condition', val: product.condition || 'Mint' },
              { icon: Award, label: 'Quality', val: 'Verified Artisan' },
              { icon: RefreshCw, label: 'Returns', val: '7-Day Policy' },
              { icon: Truck, label: 'Logistics', val: 'Global Express' }
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-4 border-r border-black/5 last:border-0 pl-8 first:pl-0">
                <item.icon className="size-6 text-black" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">{item.label}</span>
                  <span className="text-[15px] font-[900] tracking-tight">{item.val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Full-Width Product Description ── */}
      <div className="w-full px-4 md:px-6 py-12">
        <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Header tabs */}
          <div className="flex items-center px-10 pt-8">
            <div className="pb-3 border-b-[3px] border-[var(--text-primary)] text-sm font-black text-[var(--text-primary)] mr-8 tracking-[0.1em] uppercase">
              Details
            </div>
          </div>

          <div className="p-10 grid md:grid-cols-2 gap-16">
            {/* Left: Short + Long description */}
            <div className="space-y-6">
              <p className="text-[15px] text-[var(--text-secondary)] leading-[1.8]">{product.description}</p>
              {product.long_description && (
                <div className="pt-8 space-y-4">
                  <p className="text-[15px] text-[var(--text-secondary)] leading-[1.8] whitespace-pre-wrap">{product.long_description}</p>
                </div>
              )}
            </div>

            {/* Right: Key specs / highlights */}
            <div className="space-y-6 lg:pl-12">
              <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">Specifications</h2>
              <div className="space-y-6 pt-2">
                {[
                  { label: 'Category', value: product.category || 'General' },
                  { label: 'Brand', value: product.brand || vendor?.store_name || 'Aura Market' },
                  { label: 'Condition', value: product.condition || 'Brand New' },
                  { label: 'In Stock', value: inStock ? `${product.stock} units available` : 'Out of stock' },
                  { label: 'SKU', value: product._id?.slice(-10).toUpperCase() },
                  { label: 'Seller', value: vendor?.store_name || 'Official Store' },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex items-start gap-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] w-32 shrink-0">{label}</span>
                    <span className="text-[15px] text-[var(--text-primary)] font-medium leading-tight">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products ── */}
      {related.length > 0 && (
        <section className="w-full px-4 md:px-6 pb-24">
          <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg md:text-2xl font-black text-[var(--text-primary)] tracking-tighter" style={{ fontFamily: 'var(--font-manrope, inherit)' }}>You may also like</h2>
              <Link href="/shop"
                className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] hover:opacity-70 transition-opacity flex items-center gap-1 pb-1 border-b-2 border-transparent hover:border-[var(--text-primary)]">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {related.map(p => (
                <div key={p._id} className="hover:-translate-y-2 transition-transform duration-300">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Mobile Bottom CTA ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-[30px] border-t border-[var(--glass-border)]/50 p-4 pb-safe">
        <div className="flex items-center gap-3 max-w-screen-sm mx-auto">
          {!isOwnProduct && (
            <button onClick={handleChat}
              className="size-14 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] hover:scale-105 active:scale-95 transition-all shrink-0">
              <MessageCircle className="size-5" />
            </button>
          )}
          {isOwnProduct ? (
            <div className="flex-1 h-14 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center gap-2">
              <Store className="size-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--text-secondary)]">Your Listed Item</span>
            </div>
          ) : (
            <div className="flex-1 flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || !inStock}
                className="flex-1 h-14 bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--bg-secondary)] text-[11px] font-black uppercase tracking-[0.1em] rounded-full transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-50"
              >
                {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4 mb-0.5" />}
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={buyingNow || !inStock}
                className="flex-1 h-14 bg-gradient-to-br from-[#000000] to-[#1c1b1b] dark:from-white dark:to-gray-200 text-white dark:text-black text-[11px] font-black uppercase tracking-[0.1em] rounded-full shadow-[0_10px_20px_-5px_rgba(0,0,0,0.2)] transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-50"
              >
                {buyingNow ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 mb-0.5" />}
                Buy Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
