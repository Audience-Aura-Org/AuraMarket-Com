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
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BlurUpImage from '@/components/common/BlurUpImage';
import { useChat } from '@/context/ChatContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ProductDetailsPage({ productId: explicitProductId = null }) {
  const params = useParams();
  const id = explicitProductId || params?.id;
  const router = useRouter();
  const { user } = useAuthStore();
  const { openChat } = useChat();
  const { t, label } = useLanguage();
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
  const [selectedOptions, setSelectedOptions] = useState({});
  const [currentVariant, setCurrentVariant] = useState(null);

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

    const refreshWhenOnline = () => {
      load();
      api.get(`/reviews/product/${id}`).then(r => setReviews(r.data.data?.reviews || [])).catch(() => {});
      api.get(`/products/${id}/related?limit=10`).then(r => setRelated(r.data.data?.products || [])).catch(() => {});
    };
    window.addEventListener('online', refreshWhenOnline);
    return () => window.removeEventListener('online', refreshWhenOnline);
  }, [id]);

  useEffect(() => {
    if (product?.has_variants && product.variant_types?.length > 0) {
      // Default select first options
      const defaults = {};
      product.variant_types.forEach(type => {
        if (type.options?.length > 0) defaults[type.name] = type.options[0];
      });
      setSelectedOptions(defaults);
    }
  }, [product]);

  useEffect(() => {
    if (product?.has_variants && product.sku_variants?.length > 0) {
      const match = product.sku_variants.find(v => 
        Object.entries(selectedOptions).every(([k, val]) => v.combination[k] === val)
      );
      setCurrentVariant(match || null);
    } else {
      setCurrentVariant(null);
    }
  }, [selectedOptions, product]);

  const handleWishlist = async () => {
    if (!user) return router.push('/login');
    try {
      const res = await api.post('/wishlist/toggle', { product_id: id });
      const next = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(next);
      hotToast.success(next ? t('product.addedWishlist') : t('product.removedWishlist'), {
        style: { borderRadius: '16px', background: '#333', color: '#fff', fontSize: '12px', fontWeight: 'bold' }
      });
    } catch { hotToast.error(t('common.wishlistFailed')); }
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      hotToast.success(t('product.linkCopied'), {
        icon: '🔗',
        style: { borderRadius: '16px', background: '#333', color: '#fff', fontSize: '12px', fontWeight: 'bold' }
      });
    }
  };

  const handleAddToCart = async () => {
    if (!user) return router.push('/login');
    setAddingToCart(true);
    const itemToTrack = currentVariant 
      ? { ...product, price: currentVariant.price, variant: currentVariant.combination }
      : { ...product, price: displayPrice };
    trackCart(itemToTrack);
    cartStore.addItem(itemToTrack, quantity);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-item-added', {
        detail: { 
          name: product.name, 
          image: currentVariant?.image || product.images?.[0]?.url || product.images?.[0],
          variant: currentVariant?.combination 
        }
      }));
    }
    try {
      const payload = { 
        product_id: id, 
        quantity,
        variant: currentVariant?.combination
      };
      const res = await api.post('/cart', payload);
      cartStore.setCart(res.data.data.cart);
    } catch {
      hotToast.error(t('product.cartFailed'));
      cartStore.refresh();
    } finally { setAddingToCart(false); }
  };

  const handleBuyNow = async () => {
    if (!user) return router.push('/login');
    if (!product.vendor_id) return;
    
    let url = `/checkout?productId=${id}&quantity=${quantity}`;
    if (currentVariant) {
      url += `&variant=${encodeURIComponent(JSON.stringify(currentVariant.combination))}`;
    }
    router.push(url);
  };

  const handleChat = () => {
    if (!user) return router.push('/login');
    const vUserId = vendor?.user_id?._id || vendor?.user_id || vendor?._id;
    if (!vUserId) return hotToast.error(t('product.unableSeller'));
    
    openChat(vUserId, product, {
      store_name: vendor?.store_name || t('common.verifiedStore'),
      branding: { logo: vendor?.user_id?.branding?.logo || vendor?.user_id?.avatar }
    });
  };

  const handleMouseMove = (e) => {
    if (!isZoomed || !imgRef.current) return;
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    imgRef.current.style.transformOrigin = `${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`;
  };

  if (loading) return <LoadingSpinner />;

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-secondary)] gap-4">
      <AlertCircle className="size-10 text-[var(--text-secondary)]" />
      <p className="text-sm  font-semibold text-[var(--text-primary)]">{t('product.notFound')}</p>
      <button onClick={() => router.push('/shop')}
        className="px-6 py-2 text-xs  font-bold tracking-tight text-white bg-[var(--accent)] rounded-full hover:opacity-90 transition-all">
        {t('product.backToShop')}
      </button>
    </div>
  );

  const images = product?.images?.length ? product.images : [{ url: '/placeholder.png' }];
  const vendor = product?.vendor_id;
  
  const regularPrice = Number(product?.price || 0);
  const salePrice = Number(product?.sale_price || 0);
  const hasSalePrice = !currentVariant && salePrice > 0 && salePrice < regularPrice;
  const displayPrice = currentVariant ? currentVariant.price : (hasSalePrice ? salePrice : product?.price);
  const originalPrice = hasSalePrice ? regularPrice : Number(product?.oldPrice || 0);
  const displayStock = currentVariant ? currentVariant.stock : product?.stock;
  const inStock = Boolean(displayStock > 0);
  
  const rating = Number(product?.rating || 0);
  const displayRating = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : t('product.new');
  const discount = originalPrice > displayPrice
    ? Math.round(100 - (displayPrice / originalPrice) * 100)
    : null;

  // Detect if the logged-in user is the vendor who listed this product
  const vendorUserId = vendor?.user_id?._id?.toString() || vendor?.user_id?.toString();
  const isOwnProduct = Boolean(user && vendorUserId && user._id?.toString() === vendorUserId);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] font-poppins">

      {/* ── Top Nav Bar ── */}
      <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)]/70 backdrop-blur-[30px]">
        <div className="w-full px-4 md:px-6 h-11 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-xs  font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:block">{t('common.back')}</span>
          </button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--accent)] transition-colors">{t('product.home')}</Link>
            <ChevronRight className="size-3" />
            <Link href="/shop" className="hover:text-[var(--accent)] transition-colors">{t('product.shop')}</Link>
            {product.category && <>
              <ChevronRight className="size-3" />
              <span className="text-[var(--text-primary)] font-medium truncate max-w-[160px]">{label(product.category)}</span>
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
            <button onClick={handleShare}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--component-bg)] transition-all">
              <Share2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main 3-Column Layout ── */}
      <div className="w-full px-4 md:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Col 1: Media Gallery (left thumbnail + main image) ── */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col md:flex-row gap-4 md:gap-6 pl-0 md:pl-4">

          {/* Main Image (Top on mobile, Right on desktop) */}
          <div className="order-1 md:order-2 flex-1 flex flex-col gap-4">
            <div
              className="relative w-full aspect-[4/5] max-h-[500px] bg-[var(--bg-primary)] rounded-[32px] overflow-hidden cursor-zoom-in shadow-[0_40px_60px_-15px_rgba(0,0,0,0.05)]"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => { setIsZoomed(false); if (imgRef.current) imgRef.current.style.transformOrigin = 'center'; }}
              onMouseMove={handleMouseMove}
            >
              {/* Badges */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                {!inStock && (
                  <span className="px-2.5 py-1 bg-red-500 text-white text-[11px] lg:text-[12px]  font-semibold tracking-tight rounded-lg">
                    {t('common.outOfStock')}
                  </span>
                )}
                {discount && (
                  <span className="px-2.5 py-1 bg-[var(--accent)] text-white text-[11px] lg:text-[12px]  font-semibold rounded-lg">
                    -{discount}%
                  </span>
                )}
              </div>

              <BlurUpImage
                ref={imgRef}
                src={images[activeImg]?.url || images[activeImg]}
                alt={product.name}
                objectFit="contain"
                className="w-full h-full p-4"
                imgClassName={`transition-transform duration-300 ${isZoomed ? 'scale-150' : 'scale-100'}`}
              />
            </div>
          </div>

          {/* Thumbnails (Bottom on mobile, Left on desktop) */}
          <div className="order-2 md:order-1 flex flex-row md:flex-col gap-4 shrink-0 w-full md:w-16 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-[16px] md:rounded-[20px] overflow-hidden bg-[var(--bg-primary)] transition-all shrink-0 ${
                  activeImg === i
                    ? 'shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)] scale-105 ring-2 ring-[var(--text-primary)]'
                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                }`}>
                <BlurUpImage 
                  src={img.url || img} 
                  className="w-full h-full p-2" 
                  objectFit="contain"
                  alt={`View ${i + 1}`} 
                />
              </button>
            ))}
          </div>

        </div>

        {/* ── Col 2: Product Info ── */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-8 md:px-4">

          {/* Product Info — mobile-first, natural casing */}
          <div className="space-y-5 text-center lg:text-left">

            {/* Verified badge */}
            <div className="flex items-center justify-center lg:justify-start gap-1.5">
              <Shield className="size-3 text-[var(--accent)] shrink-0" />
              <span className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight">
                {t('product.verified')}
              </span>
            </div>

            {/* Product name */}
            <h1 translate="no" className="text-2xl md:text-[2.5rem]  font-bold tracking-tighter text-[var(--text-primary)] leading-[1.08]">
              {product.name}
            </h1>

            {/* Price + Stock row — compact on mobile */}
            <div className="flex items-center justify-center lg:justify-start gap-4 pt-1">
              {/* Price block */}
              <div>
                <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] mb-0.5">{t('common.price')}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl  font-bold text-[var(--text-primary)] tracking-tight leading-none">
                    {displayPrice?.toLocaleString()}
                  </span>
                  <span className="text-xs  font-bold text-[var(--accent)] leading-none pb-0.5">XAF</span>
                  {originalPrice > displayPrice && (
                    <span className="text-sm font-semibold text-[var(--text-secondary)] line-through opacity-45">
                      {originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-[var(--glass-border)] shrink-0" />

              {/* Stock pill */}
              <div>
                <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] mb-0.5">{t('status.inStock', 'In stock')}</p>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs  font-semibold ${
                  inStock
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  <span className={`size-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {inStock ? t('product.available', undefined, { count: displayStock }) : t('common.outOfStock')}
                </div>
              </div>
            </div>
          </div>

          {/* Variant Selectors */}
          {product.has_variants && product.variant_types?.length > 0 && (
            <div className="space-y-6 bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-8">
              {product.variant_types.map((type) => (
                <div key={type.name} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs  font-bold tracking-tight text-[var(--text-primary)]">
                      {t('product.selectOption', undefined, { name: label(type.name) })}
                    </span>
                    <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                      {selectedOptions[type.name]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {type.options.map((option) => {
                      const isColor = type.name.toLowerCase() === 'color';
                      const hexCode = type.metadata?.[option];
                      const isActive = selectedOptions[type.name] === option;

                      if (isColor && hexCode) {
                        return (
                          <button
                            key={option}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [type.name]: option }))}
                            title={option}
                            className={`group relative flex items-center justify-center size-10 rounded-full transition-all ${
                              isActive ? 'ring-2 ring-[var(--text-primary)] ring-offset-2' : 'ring-1 ring-[var(--glass-border)]'
                            }`}
                          >
                            <div 
                              className="size-full rounded-full border border-black/10"
                              style={{ backgroundColor: hexCode }}
                            />
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <CheckCircle2 className="size-4 text-white drop-shadow-md" />
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={option}
                          onClick={() => setSelectedOptions(prev => ({ ...prev, [type.name]: option }))}
                          className={`px-4 py-2 rounded-full text-xs  font-bold border-2 transition-all ${
                            isActive
                              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]'
                              : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]/40'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Short Description */}
          <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-8 space-y-4">
            <h2 className="text-xs md:text-sm  font-bold tracking-tight text-[var(--text-primary)]">{t('product.description')}</h2>
            <p translate="no" className="text-sm md:text-[15px] text-[var(--text-secondary)] leading-[1.8]">{product.description}</p>
          </div>

          {/* Reviews */}
          <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs  font-bold tracking-tight text-[var(--text-primary)]">
                {t('product.reviews')} ({reviews.length})
              </h2>
              <button className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 decoration-2">{t('product.seeAll')}</button>
            </div>

            {reviews.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4">{t('product.noReviews')}</p>
            ) : (
              <div className="space-y-8">
                {reviews.slice(0, 3).map((r, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs  font-semibold">{r.user_id?.name || t('product.buyer')}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`size-2.5 ${n <= r.rating ? 'text-amber-400 fill-current' : 'text-[var(--glass-border)]'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">"{r.comment}"</p>
                    <span className="text-[10px] lg:text-[12px] text-emerald-500  font-semibold">{t('product.verifiedPurchase')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Col 3: Buy Console + Seller Info ── */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-6">

          {/* Buy Console — sticky on desktop */}
          <div className="lg:sticky lg:top-[120px] flex flex-col gap-6">

            {/* Price + Quantity + CTAs */}
            <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.06)] p-8 space-y-8">
              <div className="flex items-center justify-between">
                <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)]">{t('product.quantity')}</span>
                <div className="flex items-center gap-4 bg-[var(--bg-secondary)] px-4 py-2 rounded-full">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all">
                    <Minus className="size-4" />
                  </button>
                  <span className="text-sm  font-bold w-6 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90 transition-all">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {isOwnProduct ? (
                  <div className="w-full h-14 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center gap-2">
                    <Store className="size-5 text-[var(--text-secondary)]" />
                    <span className="text-xs  font-bold tracking-tight text-[var(--text-secondary)]">{t('product.yourItem')}</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleBuyNow}
                      disabled={buyingNow || !inStock}
                      className="w-full h-14 bg-[var(--text-primary)] border-2 border-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] text-sm  font-bold tracking-tight rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {buyingNow && <Loader2 className="size-4 shrink-0 animate-spin" />}
                      <span className="min-w-0 truncate">{t('common.buyNow')}</span>
                    </button>
                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart || !inStock}
                      className="w-full h-14 bg-[var(--bg-primary)] border-2 border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] text-sm  font-bold tracking-tight rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingToCart && <Loader2 className="size-4 shrink-0 animate-spin" />}
                      <span className="min-w-0 truncate">{t('product.addToCart', 'Add to cart')}</span>
                    </button>
                  </>
                )}
              </div>

              {!inStock && (
                <p className="text-center text-xs  font-semibold text-red-500">{t('product.currentlyOut')}</p>
              )}
            </div>

            {/* Delivery Info */}
            <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-8 space-y-6">
              <h3 className="text-xs  font-bold tracking-tight text-[var(--text-primary)]">{t('product.deliveryReturns')}</h3>
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  <div className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                    <Truck className="size-4 text-[var(--text-primary)]" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm  font-bold">{t('product.expressDelivery')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('product.deliveryWindow')}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0">
                    <RefreshCw className="size-4 text-[var(--text-primary)]" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm  font-bold">{t('product.freeReturns')}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('product.returnPolicy')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seller Card */}
            {vendor && (
              <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] p-8 space-y-6">
                <h3 className="text-xs  font-bold tracking-tight text-[var(--text-primary)]">{t('product.soldBy')}</h3>
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-full overflow-hidden bg-[var(--bg-secondary)] shrink-0">
                    <img
                      src={vendor.user_id?.branding?.logo || vendor.user_id?.avatar || '/placeholder.png'}
                      className="w-full h-full object-cover"
                      alt={vendor.store_name}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p translate="no" className="text-base  font-bold truncate tracking-tight">{vendor.store_name}</p>
                      {vendor.verified && <CheckCircle2 className="size-4 text-[var(--accent)] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="size-3 text-[var(--text-primary)] fill-current" />
                      <span className="text-xs text-[var(--text-secondary)]  font-semibold">{displayRating} {t('product.rating')}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Link href={`/stores?id=${encodeURIComponent(vendor._id)}`}
                    className="h-10 flex items-center justify-center gap-2 bg-[var(--bg-secondary)] rounded-full text-xs  font-bold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/80 transition-all">
                    <Store className="size-3.5" /> {t('product.visitStore')}
                  </Link>
                  <button onClick={handleChat}
                    className="h-10 flex items-center justify-center gap-2 bg-[var(--bg-primary)] border-2 border-[var(--text-primary)] rounded-full text-xs  font-bold text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all">
                    <MessageCircle className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{t('common.chat')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full-Width Product Description ── */}
      <div className="w-full px-4 md:px-6 py-12">
        <div className="bg-[var(--bg-primary)] rounded-[32px] shadow-[0_40px_60px_-15px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Header tabs */}
          <div className="flex items-center px-10 pt-8">
            <div className="pb-3 border-b-[3px] border-[var(--text-primary)] text-sm  font-bold text-[var(--text-primary)] mr-8 tracking-tight">
              {t('product.details')}
            </div>
          </div>

          <div className="p-10 grid md:grid-cols-2 gap-16">
            {/* Left: Short + Long description */}
            <div className="space-y-6">
              <p translate="no" className="text-[15px] text-[var(--text-secondary)] leading-[1.8]">{product.description}</p>
              {product.long_description && (
                <div className="pt-8 space-y-4">
                  <p translate="no" className="text-[15px] text-[var(--text-secondary)] leading-[1.8] whitespace-pre-wrap">{product.long_description}</p>
                </div>
              )}
            </div>

            {/* Right: Key specs / highlights */}
            <div className="space-y-6 lg:pl-12">
              <h2 className="text-sm  font-bold tracking-tight text-[var(--text-primary)]">{t('product.specifications')}</h2>
              <div className="flex flex-col gap-4 pt-2">
                {[
                  { label: t('product.category'), value: product.category ? label(product.category) : t('product.general') },
                  { label: t('product.brand'), value: product.brand || vendor?.store_name || 'Aura Dime' },
                  { label: t('product.condition'), value: product.condition ? label(product.condition) : t('product.brandNew') },
                  { label: t('status.inStock', 'In stock'), value: inStock ? t('product.unitsAvailable', undefined, { count: product.stock }) : t('common.outOfStock') },
                  { label: t('product.sku'), value: product._id?.slice(-10).toUpperCase() },
                  { label: t('product.seller'), value: vendor?.store_name || t('product.officialStore') },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-[var(--glass-border)]/60 pb-4 last:border-0 last:pb-0">
                    <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] shrink-0 pt-0.5">{label}</span>
                    <span className="text-[14px] text-[var(--text-primary)]  font-bold text-right leading-tight">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products ── */}
      {related.length > 0 && (
        <section className="w-full px-4 md:px-6 pb-24 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-3xl  font-bold text-[var(--text-primary)] tracking-tighter">{t('product.related')}</h2>
            <Link href="/discovery"
              className="text-xs  font-bold tracking-tight text-[var(--text-primary)] hover:opacity-70 transition-opacity flex items-center gap-1 pb-1 border-b-2 border-transparent hover:border-[var(--text-primary)]">
              {t('product.viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {related.map(p => (
              <div key={p._id} className="hover:-translate-y-2 transition-transform duration-300">
                <ProductCard product={p} />
              </div>
            ))}
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
              <span className="text-xs  font-bold tracking-tight text-[var(--text-secondary)]">{t('product.yourItem')}</span>
            </div>
          ) : (
            <div className="flex-1 flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || !inStock}
                className="flex-1 h-14 bg-[var(--bg-primary)] border-2 border-[var(--text-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] text-[11px] lg:text-[12px]  font-semibold tracking-tight rounded-full transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {addingToCart && <Loader2 className="size-4 shrink-0 animate-spin" />}
                <span className="min-w-0 truncate">{t('product.addToCart')}</span>
              </button>
              <button
                onClick={handleBuyNow}
                disabled={buyingNow || !inStock}
                className="flex-1 h-14 bg-[var(--text-primary)] border-2 border-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] text-[11px] lg:text-[12px]  font-semibold tracking-tight rounded-full transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {buyingNow && <Loader2 className="size-4 shrink-0 animate-spin" />}
                <span className="min-w-0 truncate">{t('common.buyNow')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
