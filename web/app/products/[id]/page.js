"use client";

import { useState, useEffect, useRef } from 'react';
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

      {/* ── Top Nav Bar ── */}
      <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] backdrop-blur-xl">
        <div className="w-full px-4 md:px-6 h-11 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:block">Back</span>
          </button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--accent)] transition-colors">Home</Link>
            <ChevronRight className="size-3" />
            <Link href="/shop" className="hover:text-[var(--accent)] transition-colors">Shop</Link>
            {product.category && <>
              <ChevronRight className="size-3" />
              <span className="text-[var(--text-primary)] font-medium truncate max-w-[160px]">{product.category}</span>
            </>}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleWishlist}
              className={`p-2 rounded-lg transition-all hover:bg-[var(--component-bg)] ${wishlisted ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            {!isOwnProduct && (
              <button onClick={handleChat}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--component-bg)] transition-all">
                <MessageCircle className="size-4" />
              </button>
            )}
            <button className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--component-bg)] transition-all">
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Layout ── */}
      <div className="w-full px-4 md:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Col 1: Media Gallery (left thumbnail + main image) ── */}
        <div className="lg:col-span-4 xl:col-span-4 flex gap-2">

          {/* Vertical Thumbnails — always left of main image */}
          <div className="flex flex-col gap-2 shrink-0 w-14">
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`w-14 h-14 rounded-xl border-2 overflow-hidden bg-[var(--bg-primary)] transition-all shrink-0 ${
                  activeImg === i
                    ? 'border-[var(--accent)] shadow-sm scale-105'
                    : 'border-[var(--glass-border)] opacity-50 hover:opacity-100 hover:scale-105'
                }`}>
                <img src={img.url || img} className="w-full h-full object-contain p-1" alt={`View ${i + 1}`} />
              </button>
            ))}
          </div>

          {/* Main Image */}
          <div className="flex-1 flex flex-col gap-2">
            <div
              className="relative w-full aspect-[4/5] max-h-[360px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] overflow-hidden cursor-zoom-in"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => { setIsZoomed(false); if (imgRef.current) imgRef.current.style.transformOrigin = 'center'; }}
              onMouseMove={handleMouseMove}
            >
              {/* Badges */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                {!inStock && (
                  <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg">
                    Out of Stock
                  </span>
                )}
                {discount && (
                  <span className="px-2.5 py-1 bg-[var(--accent)] text-white text-[10px] font-bold rounded-lg">
                    -{discount}%
                  </span>
                )}
              </div>

              <img
                ref={imgRef}
                src={images[activeImg]?.url || images[activeImg]}
                alt={product.name}
                className={`w-full h-full object-contain p-4 transition-transform duration-300 ${isZoomed ? 'scale-150' : 'scale-100'}`}
              />
            </div>

          </div>
        </div>

        {/* ── Col 2: Product Info ── */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3">

          {/* Core Info Card */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-5 space-y-3">
            {/* Category + Badge */}
            <div className="flex items-center justify-between">
              {product.category && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                  {product.category}
                </span>
              )}
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <CheckCircle2 className="size-3 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Verified</span>
              </div>
            </div>

            {/* Name */}
<h1 className="text-lg md:text-2xl font-bold text-[var(--text-primary)] leading-snug">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`size-3.5 ${n <= rating ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                ))}
              </div>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {rating.toFixed(1)} ({reviews.length} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl md:text-3xl font-black text-[var(--text-primary)]">
                {product.price?.toLocaleString()} <span className="text-sm md:text-base font-bold text-[var(--accent)]">XAF</span>
              </span>
              {product.oldPrice && (
                <span className="text-sm text-[var(--text-secondary)] line-through font-medium">
                  {product.oldPrice?.toLocaleString()} XAF
                </span>
              )}
            </div>

            {/* Trust Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--component-bg)] rounded-lg border border-[var(--glass-border)]">
                <Shield className="size-3 text-emerald-500" />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Genuine</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--component-bg)] rounded-lg border border-[var(--glass-border)]">
                <RefreshCw className="size-3 text-blue-500" />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">7-Day Return</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--component-bg)] rounded-lg border border-[var(--glass-border)]">
                <Truck className="size-3 text-[var(--accent)]" />
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Fast Delivery</span>
              </div>
            </div>
          </div>

          {/* Short Description only — long description lives in the full-width section below */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-5 space-y-2">
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">Description</h2>
            <p className="text-sm md:text-base text-[var(--text-secondary)] leading-relaxed">{product.description}</p>
          </div>

          {/* Reviews */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                Reviews ({reviews.length})
              </h2>
              <button className="text-[10px] font-bold text-[var(--accent)] hover:underline">See all</button>
            </div>

            {reviews.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] italic py-2">No reviews yet.</p>
            ) : (
              <div className="space-y-3 divide-y divide-[var(--glass-border)]">
                {reviews.slice(0, 3).map((r, i) => (
                  <div key={i} className="pt-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{r.user_id?.name || 'Buyer'}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`size-2.5 ${n <= r.rating ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">"{r.comment}"</p>
                    <span className="text-[10px] text-emerald-500 font-semibold">✓ Verified Purchase</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Col 3: Buy Console + Seller Info ── */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3">

          {/* Buy Console — sticky on desktop */}
          <div className="lg:sticky lg:top-[120px] flex flex-col gap-3">

            {/* Price + Quantity + CTAs */}
            <div className="bg-[var(--bg-primary)] rounded-2xl border-2 border-[var(--accent)]/30 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Quantity</span>
                <div className="flex items-center gap-3 bg-[var(--component-bg)] px-3 py-1.5 rounded-xl border border-[var(--glass-border)]">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all">
                    <Minus className="size-4" />
                  </button>
                  <span className="text-sm font-black w-5 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {isOwnProduct ? (
                  <div className="w-full h-12 rounded-xl bg-[var(--component-bg)] border border-[var(--glass-border)] flex items-center justify-center gap-2">
                    <Store className="size-4 text-[var(--text-secondary)]" />
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Your Listed Item</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart || !inStock}
                      className="w-full h-12 bg-[var(--accent)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                      Add to Cart
                    </button>
                    <button
                      onClick={handleBuyNow}
                      disabled={buyingNow || !inStock}
                      className="w-full h-12 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-80 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {buyingNow ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                      Buy Now
                    </button>
                  </>
                )}
              </div>

              {!inStock && (
                <p className="text-center text-xs font-semibold text-red-500">Currently out of stock</p>
              )}
            </div>

            {/* Delivery Info */}
            <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Delivery & Returns</h3>
              <div className="space-y-2.5">
                <div className="flex gap-3 items-start">
                  <div className="size-7 rounded-lg bg-[var(--component-bg)] flex items-center justify-center shrink-0">
                    <Truck className="size-3.5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Express Delivery</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">24–48h in major cities</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="size-7 rounded-lg bg-[var(--component-bg)] flex items-center justify-center shrink-0">
                    <RefreshCw className="size-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Free Returns</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">7-day easy return policy</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="size-7 rounded-lg bg-[var(--component-bg)] flex items-center justify-center shrink-0">
                    <Shield className="size-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Buyer Protection</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Full purchase guarantee</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seller Card */}
            {vendor && (
              <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-4 space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Sold by</h3>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl overflow-hidden bg-[var(--component-bg)] border border-[var(--glass-border)] shrink-0">
                    <img
                      src={vendor.user_id?.branding?.logo || vendor.user_id?.avatar || '/placeholder.png'}
                      className="w-full h-full object-cover"
                      alt={vendor.store_name}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold truncate">{vendor.store_name}</p>
                      {vendor.verified && <CheckCircle2 className="size-3 text-blue-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="size-2.5 text-amber-400 fill-current" />
                      <span className="text-[10px] text-[var(--text-secondary)] font-medium">4.8 · 98% Positive</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/stores/${vendor._id}`}
                    className="h-8 flex items-center justify-center gap-1.5 bg-[var(--component-bg)] border border-[var(--glass-border)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-all">
                    <Store className="size-3" /> Visit Store
                  </Link>
                  <button onClick={handleChat}
                    className="h-8 flex items-center justify-center gap-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all">
                    <MessageCircle className="size-3" /> Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full-Width Product Description ── */}
      <div className="w-full px-4 md:px-6 pt-2 pb-2">
        <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] overflow-hidden">
          {/* Header tabs */}
          <div className="flex items-center border-b border-[var(--glass-border)] px-6">
            <div className="py-3.5 px-1 border-b-2 border-[var(--accent)] text-xs font-bold text-[var(--accent)] mr-6">
              Product Details
            </div>
            {reviews.length > 0 && (
              <div className="py-3.5 px-1 text-xs font-semibold text-[var(--text-secondary)]">
                Reviews ({reviews.length})
              </div>
            )}
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-8">
            {/* Left: Short + Long description */}
            <div className="space-y-4">
              <h2 className="text-sm md:text-base font-bold text-[var(--text-primary)]">About this product</h2>
              <p className="text-sm md:text-base text-[var(--text-secondary)] leading-relaxed">{product.description}</p>
              {product.long_description && (
                <div className="pt-4 border-t border-[var(--glass-border)] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Full Description</p>
                  <p className="text-sm md:text-base text-[var(--text-secondary)] leading-loose whitespace-pre-wrap">{product.long_description}</p>
                </div>
              )}
            </div>

            {/* Right: Key specs / highlights */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Key Highlights</h2>
              <div className="space-y-2">
                {[
                  { label: 'Category', value: product.category || 'General' },
                  { label: 'Brand', value: product.brand || vendor?.store_name || 'Aura Market' },
                  { label: 'Condition', value: product.condition || 'Brand New' },
                  { label: 'In Stock', value: inStock ? `${product.stock} units available` : 'Out of stock' },
                  { label: 'SKU', value: product._id?.slice(-10).toUpperCase() },
                  { label: 'Seller', value: vendor?.store_name || 'Official Store' },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex items-start gap-3 py-2 border-b border-[var(--glass-border)] last:border-0">
                    <span className="text-xs font-semibold text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
                    <span className="text-xs text-[var(--text-primary)] font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products ── */}
      {related.length > 0 && (
        <section className="w-full px-4 md:px-6 pt-2 pb-24">
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--glass-border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">You may also like</h2>
              <Link href="/shop"
                className="text-[10px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1">
                View all <ChevronRight className="size-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {related.map(p => (
                <div key={p._id} className="hover:-translate-y-1 transition-transform duration-300">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Mobile Bottom CTA ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--glass-border)] p-3">
        <div className="flex items-center gap-2 max-w-screen-sm mx-auto">
          {!isOwnProduct && (
            <button onClick={handleChat}
              className="size-11 rounded-xl bg-[var(--component-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shrink-0">
              <MessageCircle className="size-5" />
            </button>
          )}
          {isOwnProduct ? (
            <div className="flex-1 h-11 rounded-xl bg-[var(--component-bg)] border border-[var(--glass-border)] flex items-center justify-center gap-2">
              <Store className="size-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Your Listed Item</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || !inStock}
                className="flex-1 h-11 bg-[var(--accent)] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={buyingNow || !inStock}
                className="flex-1 h-11 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {buyingNow ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Buy Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
