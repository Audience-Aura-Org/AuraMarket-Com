"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Star,
  ShoppingBag, Zap, Plus, Minus, Loader2, CheckCircle2,
  ChevronRight, ChevronLeft, Truck, Shield, RefreshCw, Package,
  AlertCircle, Award, Store, Eye, Clock, MapPin, X,
  ThumbsUp, Copy, Facebook, Twitter, Send, Tag,
  Sparkles, Flame, TrendingUp, BadgeCheck, Globe,
  ShieldCheck, CreditCard, Lock, ChevronDown, Maximize2
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { trackView, trackCart } from '@/services/tracking';
import ProductCard from '@/components/ProductCard';
import cartStore from '@/services/cartStore';
import { toast as hotToast } from 'react-hot-toast';

/* ════════════════════════════════════════════════════════════
   LUXE ARCHI · PRODUCT DETAIL · EDITORIAL CURATED EXPERIENCE
   ════════════════════════════════════════════════════════════ */

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const imgRef = useRef(null);
  const galleryRef = useRef(null);

  // State
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState({});
  const [viewersCount, setViewersCount] = useState(0);
  const [expandedReview, setExpandedReview] = useState(null);

  /* ─── Data Load ─── */
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          const p = res.data.data.product;
          setProduct(p);
          api.post(`/products/${id}/view`).catch(() => {});
          trackView(p);

          // Track in recently viewed (localStorage)
          try {
            const rv = JSON.parse(localStorage.getItem('aura_recently_viewed') || '[]');
            const filtered = rv.filter(x => x._id !== p._id);
            filtered.unshift({ _id: p._id, name: p.name, price: p.price, images: p.images });
            localStorage.setItem('aura_recently_viewed', JSON.stringify(filtered.slice(0, 10)));
          } catch {}
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    api.get(`/reviews/product/${id}`).then(r => setReviews(r.data.data?.reviews || [])).catch(() => {});
    api.get(`/products/${id}/related?limit=10`).then(r => setRelated(r.data.data?.products || [])).catch(() => {});

    // Load recently viewed from storage
    try {
      const rv = JSON.parse(localStorage.getItem('aura_recently_viewed') || '[]');
      setRecentlyViewed(rv.filter(x => x._id !== id).slice(0, 6));
    } catch {}

    // Mock social proof
    setViewersCount(Math.floor(Math.random() * 30) + 5);
  }, [id]);

  /* ─── Actions ─── */
  const handleWishlist = async () => {
    if (!user) return router.push('/login');
    try {
      const res = await api.post('/wishlist/toggle', { product_id: id });
      const next = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(next);
      hotToast.success(next ? 'Saved to wishlist' : 'Removed from wishlist', {
        style: { borderRadius: '16px', background: '#1a1a1a', color: '#fff', fontSize: '12px', fontWeight: 700 }
      });
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
      hotToast.success('Added to cart', {
        style: { borderRadius: '16px', background: '#1a1a1a', color: '#fff', fontSize: '12px', fontWeight: 700 }
      });
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

  const handleShare = async (platform) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Check out ${product?.name} on Aura Market`;
    if (platform === 'copy') {
      try { await navigator.clipboard.writeText(url); hotToast.success('Link copied'); }
      catch { hotToast.error('Copy failed'); }
    } else if (platform === 'native' && navigator.share) {
      try { await navigator.share({ title: product?.name, text, url }); }
      catch {}
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    }
    setShareOpen(false);
  };

  const handleMouseMove = (e) => {
    if (!isZoomed || !imgRef.current) return;
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    imgRef.current.style.transformOrigin = `${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`;
  };

  /* ─── Review stats ─── */
  const reviewStats = useMemo(() => {
    if (!reviews.length) return { avg: 0, dist: [0,0,0,0,0], total: 0 };
    const dist = [0,0,0,0,0];
    let sum = 0;
    reviews.forEach(r => {
      const rr = Math.max(1, Math.min(5, Math.round(r.rating || 0)));
      dist[5 - rr]++;
      sum += r.rating || 0;
    });
    return { avg: sum / reviews.length, dist, total: reviews.length };
  }, [reviews]);

  /* ─── Loading / 404 ─── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-12">
          <div className="absolute inset-0 border-2 border-[var(--glass-border)] rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-[var(--text-primary)] rounded-full animate-spin" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Curating</p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-secondary)] gap-5 px-6">
      <div className="size-20 rounded-full bg-[var(--bg-primary)] flex items-center justify-center">
        <AlertCircle className="size-8 text-[var(--text-secondary)]" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-black text-[var(--text-primary)] tracking-tight">Piece unavailable</p>
        <p className="text-xs text-[var(--text-secondary)]">This item is no longer in our curation.</p>
      </div>
      <button onClick={() => router.push('/shop')}
        className="px-8 h-12 text-[11px] font-black uppercase tracking-[0.2em] text-white bg-gradient-to-br from-black to-zinc-800 rounded-full hover:opacity-90 transition-all">
        Explore Collection
      </button>
    </div>
  );

  /* ─── Derived ─── */
  const images = product?.images?.length ? product.images : [{ url: '/placeholder.png' }];
  const vendor = product?.vendor_id;
  const inStock = Boolean(product?.stock > 0);
  const lowStock = inStock && product?.stock <= 5;
  const rating = reviewStats.avg || Number(product?.rating || 0);
  const discount = product?.oldPrice
    ? Math.round(100 - (product.price / product.oldPrice) * 100)
    : null;
  const savings = product?.oldPrice ? product.oldPrice - product.price : 0;

  const vendorUserId = vendor?.user_id?._id?.toString() || vendor?.user_id?.toString();
  const isOwnProduct = Boolean(user && vendorUserId && user._id?.toString() === vendorUserId);

  // Variants (color / size) — works if product has them, otherwise hidden
  const variantKeys = product?.variants ? Object.keys(product.variants) : [];

  const nextImg = () => setActiveImg(i => (i + 1) % images.length);
  const prevImg = () => setActiveImg(i => (i - 1 + images.length) % images.length);

  /* ─────────── RENDER ─────────── */
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] pb-24 lg:pb-0">

      {/* ══════════════ Glass Sub-Nav ══════════════ */}
      <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)]/70 backdrop-blur-[30px]">
        <div className="w-full px-4 md:px-8 h-12 flex items-center justify-between max-w-[1600px] mx-auto">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:block">Back</span>
          </button>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Home</Link>
            <ChevronRight className="size-3 opacity-40" />
            <Link href="/shop" className="hover:text-[var(--text-primary)] transition-colors">Shop</Link>
            {product.category && <>
              <ChevronRight className="size-3 opacity-40" />
              <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-[var(--text-primary)] transition-colors">{product.category}</Link>
            </>}
            <ChevronRight className="size-3 opacity-40" />
            <span className="text-[var(--text-primary)] truncate max-w-[180px] normal-case tracking-normal font-semibold">{product.name}</span>
          </nav>

          <div className="flex items-center gap-1">
            <button onClick={handleWishlist}
              className={`size-9 rounded-full flex items-center justify-center transition-all hover:bg-[var(--bg-secondary)] ${wishlisted ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            {!isOwnProduct && (
              <button onClick={handleChat}
                className="size-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all">
                <MessageCircle className="size-4" />
              </button>
            )}
            <div className="relative">
              <button onClick={() => setShareOpen(v => !v)}
                className="size-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all">
                <Share2 className="size-4" />
              </button>
              {shareOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--bg-primary)] rounded-2xl shadow-[0_40px_60px_-15px_rgba(0,0,0,0.15)] p-2 z-50">
                  {[
                    { icon: Copy, label: 'Copy link', action: 'copy' },
                    { icon: Send, label: 'WhatsApp', action: 'whatsapp' },
                    { icon: Facebook, label: 'Facebook', action: 'facebook' },
                    { icon: Twitter, label: 'Twitter', action: 'twitter' },
                  ].map(it => (
                    <button key={it.action} onClick={() => handleShare(it.action)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors text-left">
                      <it.icon className="size-3.5 text-[var(--text-secondary)]" />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{it.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ HERO: Gallery + Info ══════════════ */}
      <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-6 lg:pt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">

        {/* ─── LEFT · Gallery ─── */}
        <div className="lg:col-span-7 flex gap-3 md:gap-5">

          {/* Vertical thumbnails (desktop) */}
          <div className="hidden md:flex flex-col gap-3 shrink-0 w-20">
            {images.slice(0, 6).map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`w-20 h-20 rounded-2xl overflow-hidden bg-[var(--bg-primary)] transition-all shrink-0 relative ${
                  activeImg === i
                    ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-secondary)] scale-[1.02]'
                    : 'opacity-50 hover:opacity-100'
                }`}>
                <img src={img.url || img} className="w-full h-full object-cover" alt={`View ${i + 1}`} />
              </button>
            ))}
            {images.length > 6 && (
              <div className="w-20 h-20 rounded-2xl bg-[var(--bg-primary)] flex items-center justify-center">
                <span className="text-[10px] font-black text-[var(--text-secondary)]">+{images.length - 6}</span>
              </div>
            )}
          </div>

          {/* Main Image */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div
              ref={galleryRef}
              className="relative w-full aspect-square md:aspect-[4/5] bg-[var(--bg-primary)] rounded-[28px] md:rounded-[36px] overflow-hidden cursor-zoom-in group/gallery"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => { setIsZoomed(false); if (imgRef.current) imgRef.current.style.transformOrigin = 'center'; }}
              onMouseMove={handleMouseMove}
            >
              {/* Top-left badges */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {!inStock && (
                  <span className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full">
                    Sold Out
                  </span>
                )}
                {discount && (
                  <span className="px-3 py-1.5 bg-gradient-to-br from-black to-zinc-800 text-white text-[10px] font-black rounded-full flex items-center gap-1">
                    <Flame className="size-3" /> -{discount}%
                  </span>
                )}
                {product.featured && (
                  <span className="px-3 py-1.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-1">
                    <Sparkles className="size-3" /> Curated
                  </span>
                )}
              </div>

              {/* Expand button */}
              <button onClick={() => setLightboxOpen(true)}
                className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center text-black hover:bg-white transition-all opacity-0 group-hover/gallery:opacity-100">
                <Maximize2 className="size-4" />
              </button>

              <img
                ref={imgRef}
                src={images[activeImg]?.url || images[activeImg]}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform duration-500 ${isZoomed ? 'scale-150' : 'scale-100'}`}
              />

              {/* Prev/Next */}
              {images.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); prevImg(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center text-black hover:bg-white transition-all opacity-0 group-hover/gallery:opacity-100">
                    <ChevronLeft className="size-5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); nextImg(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/80 backdrop-blur-xl flex items-center justify-center text-black hover:bg-white transition-all opacity-0 group-hover/gallery:opacity-100">
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-full text-white text-[10px] font-bold">
                {activeImg + 1} / {images.length}
              </div>
            </div>

            {/* Horizontal thumbnails (mobile) */}
            <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden bg-[var(--bg-primary)] shrink-0 snap-start transition-all ${
                    activeImg === i ? 'ring-2 ring-[var(--text-primary)]' : 'opacity-50'
                  }`}>
                  <img src={img.url || img} className="w-full h-full object-cover" alt={`View ${i + 1}`} />
                </button>
              ))}
            </div>

            {/* Social proof strip */}
            <div className="hidden md:flex items-center gap-6 px-2 text-[11px] text-[var(--text-secondary)] font-semibold">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {viewersCount} viewing now
              </span>
              {product.purchase_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" /> {product.purchase_count} sold
                </span>
              )}
              {product.view_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye className="size-3.5" /> {product.view_count?.toLocaleString()} views
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT · Info & Buy Console ─── */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Core Info */}
          <div className="space-y-5">
            {/* Category pill + verified */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.category && (
                <Link href={`/shop?category=${encodeURIComponent(product.category)}`}
                  className="px-3 py-1 bg-[var(--bg-primary)] rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {product.category}
                </Link>
              )}
              {product.brand && (
                <span className="px-3 py-1 bg-[var(--bg-primary)] rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  {product.brand}
                </span>
              )}
              {vendor?.verified && (
                <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 rounded-full">
                  <BadgeCheck className="size-3 text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Verified</span>
                </span>
              )}
            </div>

            {/* Product Name · Display typography */}
            <h1 className="text-[2.25rem] md:text-[3rem] lg:text-[3.5rem] font-black text-[var(--text-primary)] leading-[1.02] tracking-[-0.035em]">
              {product.name}
            </h1>

            {/* Subtitle / short desc */}
            {product.description && (
              <p className="text-[15px] text-[var(--text-secondary)] leading-[1.7] max-w-xl">
                {product.description.length > 160 ? product.description.slice(0, 160) + '…' : product.description}
              </p>
            )}

            {/* Rating */}
            {reviews.length > 0 && (
              <button onClick={() => { setActiveTab('reviews'); document.getElementById('tabs-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="flex items-center gap-3 group/rating">
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`size-4 ${n <= Math.round(rating) ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">{rating.toFixed(1)}</span>
                <span className="text-xs text-[var(--text-secondary)] underline underline-offset-4 decoration-dotted group-hover/rating:text-[var(--text-primary)]">
                  {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                </span>
              </button>
            )}
          </div>

          {/* Price block */}
          <div className="space-y-2 pt-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[2rem] md:text-[2.5rem] font-black text-[var(--text-primary)] tracking-[-0.03em] leading-none">
                {product.price?.toLocaleString()}
                <span className="text-sm md:text-base font-bold text-[var(--text-secondary)] ml-1.5">XAF</span>
              </span>
              {product.oldPrice && (
                <>
                  <span className="text-lg text-[var(--text-secondary)] line-through font-semibold">
                    {product.oldPrice?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Save {savings.toLocaleString()}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] font-semibold">
              Tax included · <Link href="/help" className="underline underline-offset-2">Shipping</Link> calculated at checkout
            </p>
          </div>

          {/* Variants (if present) */}
          {variantKeys.length > 0 && (
            <div className="space-y-4">
              {variantKeys.map(key => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{key}</span>
                    {selectedVariant[key] && (
                      <span className="text-[11px] font-semibold text-[var(--text-primary)]">{selectedVariant[key]}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(product.variants[key] || []).map(val => (
                      <button key={val} onClick={() => setSelectedVariant(v => ({ ...v, [key]: val }))}
                        className={`px-4 h-10 rounded-full text-xs font-bold transition-all ${
                          selectedVariant[key] === val
                            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                            : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        }`}>{val}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stock urgency */}
          {lowStock && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 rounded-2xl">
              <Flame className="size-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-700">Only {product.stock} left — almost gone</span>
            </div>
          )}

          {/* Quantity + CTAs */}
          {!isOwnProduct ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                {/* Qty */}
                <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-full h-14 px-2">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="size-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] active:scale-90 transition-all">
                    <Minus className="size-4" />
                  </button>
                  <span className="text-sm font-black w-8 text-center tabular-nums">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)}
                    disabled={quantity >= (product.stock || 99)}
                    className="size-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] active:scale-90 transition-all disabled:opacity-30">
                    <Plus className="size-4" />
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !inStock}
                  className="flex-1 h-14 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[11px] font-black uppercase tracking-[0.2em] rounded-full transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-secondary)] active:scale-[0.98]"
                >
                  {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                  Add to Cart
                </button>
              </div>

              {/* Buy Now */}
              <button
                onClick={handleBuyNow}
                disabled={buyingNow || !inStock}
                className="w-full h-14 bg-gradient-to-br from-black to-zinc-800 dark:from-white dark:to-gray-200 text-white dark:text-black text-[11px] font-black uppercase tracking-[0.25em] rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.25)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buyingNow ? <Loader2 className="size-5 animate-spin" /> : <Zap className="size-5" />}
                Buy Now — {(product.price * quantity).toLocaleString()} XAF
              </button>

              <div className="flex items-center justify-center gap-4 pt-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1"><Lock className="size-3" /> Secure Checkout</span>
                <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Escrow Protected</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-14 rounded-full bg-[var(--bg-primary)] flex items-center justify-center gap-2">
              <Store className="size-4 text-[var(--text-secondary)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Your Listed Item</span>
            </div>
          )}

          {/* Trust Strip - Tonal cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4">
            {[
              { icon: Truck, label: 'Express', sub: '24-48h' },
              { icon: RefreshCw, label: 'Returns', sub: '7 days' },
              { icon: ShieldCheck, label: 'Genuine', sub: 'Verified' },
              { icon: CreditCard, label: 'Secure', sub: 'Escrow' },
            ].map(t => (
              <div key={t.label} className="flex flex-col items-start gap-1 p-3 bg-[var(--bg-primary)] rounded-2xl">
                <t.icon className="size-4 text-[var(--text-primary)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">{t.label}</span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-semibold">{t.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Seller Card */}
          {vendor && (
            <div className="bg-[var(--bg-primary)] rounded-3xl p-6 space-y-5">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Sold by</span>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] shrink-0">
                  <img
                    src={vendor.user_id?.branding?.logo || vendor.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor.store_name || 'A'}`}
                    className="w-full h-full object-cover"
                    alt={vendor.store_name}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-base font-black truncate tracking-tight">{vendor.store_name}</p>
                    {vendor.verified && <CheckCircle2 className="size-4 text-blue-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-amber-400 text-amber-400" /> 4.8
                    </span>
                    <span>·</span>
                    <span>98% Positive</span>
                    {vendor.location && <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><MapPin className="size-3" />{vendor.location}</span>
                    </>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link href={`/stores/${vendor._id}`}
                  className="h-11 flex items-center justify-center gap-2 bg-[var(--bg-secondary)] rounded-full text-[11px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/70 transition-all">
                  <Store className="size-3.5" /> Visit Store
                </Link>
                {!isOwnProduct && (
                  <button onClick={handleChat}
                    className="h-11 flex items-center justify-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[11px] font-black uppercase tracking-[0.1em] hover:opacity-90 transition-all">
                    <MessageCircle className="size-3.5" /> Message
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ TABS · Details / Specs / Reviews / Shipping ══════════════ */}
      <section id="tabs-section" className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-16 lg:py-24">
        {/* Tab Triggers */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 pb-2 mb-8 scrollbar-hide">
          {[
            { id: 'details', label: 'Details' },
            { id: 'specs', label: 'Specifications' },
            { id: 'reviews', label: `Reviews (${reviews.length})` },
            { id: 'shipping', label: 'Shipping & Returns' },
            { id: 'faq', label: 'FAQ' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-5 h-11 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Details ─── */}
        {activeTab === 'details' && (
          <div className="grid md:grid-cols-12 gap-10 md:gap-16">
            <div className="md:col-span-7 space-y-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">The Story</h3>
              <h2 className="text-2xl md:text-4xl font-black leading-[1.15] tracking-[-0.02em]">
                {product.name}
              </h2>
              <p className="text-base text-[var(--text-secondary)] leading-[1.9]">{product.description}</p>
              {product.long_description && (
                <p className="text-base text-[var(--text-secondary)] leading-[1.9] whitespace-pre-wrap">
                  {product.long_description}
                </p>
              )}
            </div>
            <div className="md:col-span-5 md:pl-8">
              <div className="bg-[var(--bg-primary)] rounded-3xl p-8 space-y-6 sticky top-32">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Highlights</h3>
                <div className="space-y-5">
                  {(product.highlights?.length ? product.highlights : [
                    'Premium materials & construction',
                    'Curated by Aura specialists',
                    'Ships with authenticity certificate',
                    'Eligible for Aura Escrow Protection',
                  ]).map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="size-3.5 text-[var(--text-primary)]" />
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed flex-1">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Specs ─── */}
        {activeTab === 'specs' && (
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-6 max-w-4xl">
            {[
              { label: 'Category', value: product.category || 'General' },
              { label: 'Brand', value: product.brand || vendor?.store_name || 'Aura Market' },
              { label: 'Condition', value: product.condition || 'Brand New' },
              { label: 'Availability', value: inStock ? `${product.stock} units in stock` : 'Out of stock' },
              { label: 'SKU', value: product._id?.slice(-10).toUpperCase() },
              { label: 'Seller', value: vendor?.store_name || 'Official Store' },
              { label: 'Material', value: product.material },
              { label: 'Dimensions', value: product.dimensions },
              { label: 'Weight', value: product.weight },
              { label: 'Origin', value: product.origin },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-6 pb-5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] w-32 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-[var(--text-primary)] font-semibold text-right flex-1">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Reviews ─── */}
        {activeTab === 'reviews' && (
          <div className="grid lg:grid-cols-12 gap-10">
            {/* Summary */}
            <div className="lg:col-span-4">
              <div className="bg-[var(--bg-primary)] rounded-3xl p-8 space-y-6 sticky top-32">
                <div className="space-y-1">
                  <p className="text-[5rem] font-black leading-none tracking-[-0.05em]">{rating.toFixed(1)}</p>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`size-4 ${n <= Math.round(rating) ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold pt-1">
                    Based on {reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {[5,4,3,2,1].map((s, idx) => {
                    const count = reviewStats.dist[5 - s];
                    const pct = reviewStats.total ? (count / reviewStats.total) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-[var(--text-secondary)] w-3">{s}</span>
                        <Star className="size-3 text-amber-400 fill-current" />
                        <div className="flex-1 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--text-primary)]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] w-6 text-right tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>

                <button className="w-full h-12 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all">
                  Write a Review
                </button>
              </div>
            </div>

            {/* List */}
            <div className="lg:col-span-8 space-y-8">
              {reviews.length === 0 ? (
                <div className="bg-[var(--bg-primary)] rounded-3xl p-12 text-center space-y-3">
                  <Star className="size-8 text-[var(--text-secondary)] mx-auto" />
                  <p className="text-base font-bold">Be the first to review</p>
                  <p className="text-sm text-[var(--text-secondary)]">Share your experience with this piece.</p>
                </div>
              ) : (
                reviews.map((r, i) => {
                  const isLong = (r.comment?.length || 0) > 240;
                  const expanded = expandedReview === i;
                  return (
                    <div key={i} className="space-y-3 pb-8">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-sm font-black">
                            {(r.user_id?.name || 'B')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black">{r.user_id?.name || 'Buyer'}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-semibold">
                              {new Date(r.createdAt || Date.now()).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={`size-3.5 ${n <= r.rating ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] leading-[1.8]">
                        {isLong && !expanded ? `${r.comment.slice(0, 240)}…` : r.comment}
                      </p>
                      {isLong && (
                        <button onClick={() => setExpandedReview(expanded ? null : i)}
                          className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)] underline underline-offset-4">
                          {expanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Verified Purchase
                        </span>
                        <button className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                          <ThumbsUp className="size-3" /> Helpful ({r.helpful || 0})
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── Shipping ─── */}
        {activeTab === 'shipping' && (
          <div className="grid md:grid-cols-2 gap-10 max-w-5xl">
            {[
              {
                icon: Truck,
                title: 'Express Delivery',
                desc: 'Premium 24-48h delivery in major cities. All orders tracked end-to-end with live updates via SMS & email.',
                bullets: ['Free on orders over 50,000 XAF', 'Tracked & insured', 'Signature on delivery'],
              },
              {
                icon: Globe,
                title: 'International Shipping',
                desc: 'We ship to select countries worldwide. Customs duties calculated at checkout for transparent pricing.',
                bullets: ['5-12 business days', 'Duties prepaid option', 'Climate-neutral'],
              },
              {
                icon: RefreshCw,
                title: 'Easy Returns',
                desc: 'Not quite right? Return within 7 days for a full refund. No questions asked on unused items.',
                bullets: ['7-day return window', 'Free return shipping', 'Refund in 3-5 days'],
              },
              {
                icon: ShieldCheck,
                title: 'Escrow Protection',
                desc: 'Your payment is held securely until you confirm your order. 100% buyer protection guaranteed.',
                bullets: ['Funds held in escrow', 'Release on receipt', 'Dispute resolution'],
              },
            ].map(s => (
              <div key={s.title} className="bg-[var(--bg-primary)] rounded-3xl p-8 space-y-4">
                <div className="size-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center">
                  <s.icon className="size-5 text-[var(--text-primary)]" />
                </div>
                <h3 className="text-lg font-black tracking-tight">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-[1.7]">{s.desc}</p>
                <ul className="space-y-2 pt-2">
                  {s.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* ─── FAQ ─── */}
        {activeTab === 'faq' && (
          <div className="max-w-3xl space-y-2">
            {[
              { q: 'Is this product authentic?', a: 'Yes. Every piece sold on Aura Market is verified by our curation team and ships with an authenticity certificate where applicable.' },
              { q: 'How long does delivery take?', a: 'Express delivery arrives within 24-48 hours in major cities. Rural and international orders typically arrive within 5-12 business days.' },
              { q: 'Can I return it if I change my mind?', a: 'Absolutely. You have 7 days from delivery to return any unused item for a full refund. Return shipping is on us.' },
              { q: 'How secure is my payment?', a: 'All payments are protected by Aura Escrow. Your funds are held securely and only released to the seller after you confirm receipt.' },
              { q: 'Can I message the seller?', a: 'Yes — use the Message button to chat directly with the vendor about specifications, customization, or delivery.' },
            ].map((f, i) => (
              <details key={i} className="group bg-[var(--bg-primary)] rounded-2xl">
                <summary className="flex items-center justify-between gap-6 p-6 cursor-pointer list-none">
                  <span className="text-sm font-black tracking-tight">{f.q}</span>
                  <ChevronDown className="size-4 text-[var(--text-secondary)] transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <p className="px-6 pb-6 text-sm text-[var(--text-secondary)] leading-[1.8]">{f.a}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════ RELATED ══════════════ */}
      {related.length > 0 && (
        <section className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-12 lg:py-20">
          <div className="flex items-end justify-between mb-8 lg:mb-12">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Curated Pairings</span>
              <h2 className="text-2xl md:text-4xl font-black tracking-[-0.03em]">You may also love</h2>
            </div>
            <Link href="/shop"
              className="hidden md:inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] hover:opacity-70 transition-opacity pb-1 border-b-2 border-[var(--text-primary)]">
              View all <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {related.slice(0, 10).map(p => (
              <div key={p._id} className="hover:-translate-y-1 transition-transform duration-500">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════ RECENTLY VIEWED ══════════════ */}
      {recentlyViewed.length > 0 && (
        <section className="w-full max-w-[1600px] mx-auto px-4 md:px-8 pb-20">
          <div className="space-y-2 mb-8">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Your Journey</span>
            <h2 className="text-xl md:text-2xl font-black tracking-[-0.03em]">Recently viewed</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {recentlyViewed.map(p => (
              <Link key={p._id} href={`/products/${p._id}`}
                className="shrink-0 snap-start w-40 md:w-48 group/rv">
                <div className="aspect-square rounded-2xl overflow-hidden bg-[var(--bg-primary)] mb-2">
                  <img src={p.images?.[0]?.url || p.images?.[0] || '/placeholder.png'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/rv:scale-105"
                    alt={p.name} />
                </div>
                <p className="text-xs font-bold truncate">{p.name}</p>
                <p className="text-[11px] text-[var(--text-secondary)] font-semibold">{p.price?.toLocaleString()} XAF</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════ MOBILE STICKY BUY BAR ══════════════ */}
      {!isOwnProduct && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur-[30px] px-4 py-3 pb-safe">
          <div className="flex items-center gap-2 max-w-screen-sm mx-auto">
            <button onClick={handleWishlist}
              className={`size-12 rounded-full flex items-center justify-center shrink-0 transition-all ${wishlisted ? 'bg-red-500/10 text-red-500' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            <button onClick={handleChat}
              className="size-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] shrink-0 transition-all">
              <MessageCircle className="size-4" />
            </button>
            <button
              onClick={handleAddToCart}
              disabled={addingToCart || !inStock}
              className="flex-1 h-12 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-3.5" />}
              Cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={buyingNow || !inStock}
              className="flex-[1.5] h-12 bg-gradient-to-br from-black to-zinc-800 dark:from-white dark:to-gray-200 text-white dark:text-black text-[10px] font-black uppercase tracking-[0.15em] rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {buyingNow ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-3.5" />}
              Buy · {(product.price * quantity).toLocaleString()}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ LIGHTBOX ══════════════ */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-6 right-6 size-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
            onClick={() => setLightboxOpen(false)}>
            <X className="size-5" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={images[activeImg]?.url || images[activeImg]}
              className="max-w-full max-h-full object-contain" alt={product.name} />
            {images.length > 1 && (
              <>
                <button onClick={prevImg}
                  className="absolute left-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                  <ChevronLeft className="size-6" />
                </button>
                <button onClick={nextImg}
                  className="absolute right-6 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-xl rounded-full px-3 py-2">
              {images.map((_, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`size-1.5 rounded-full transition-all ${i === activeImg ? 'bg-white w-6' : 'bg-white/40'}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
