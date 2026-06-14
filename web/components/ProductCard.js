"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShoppingCart, Star, Plus, ShieldCheck, 
  MessageSquare, Eye, Heart, 
  UserPlus, UserCheck, Compass, Check
} from 'lucide-react';
import { trackAction, trackWishlist } from '@/services/tracking';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { useFollow } from '@/hooks/useFollow';
import api from '@/services/api';
import cartStore from '@/services/cartStore';
import { toast } from 'react-hot-toast';
import BlurUpImage from '@/components/common/BlurUpImage';
import VariantSelectorModal from '@/components/common/VariantSelectorModal';
import { useLanguage } from '@/context/LanguageContext';

/**
 * ProductCard - Elite Nexus Version
 * Standardized premium card used across Hub and Shop.
 */
export default function ProductCard({ product, layout = 'grid', onOpenChat = null, onClick = null }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { id, _id, name, price, compare_at_price, images, rating, vendor_id, category } = product;
  const numericPrice = Number(price || 0);
  const numericOriginalPrice = compare_at_price !== undefined && compare_at_price !== null ? Number(compare_at_price) : 0;
  const isOnSale = numericOriginalPrice > numericPrice;
  const displayPrice = numericPrice;
  const displayOriginalPrice = isOnSale ? numericOriginalPrice : null;
  const discountPercent = isOnSale
    ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
    : 0;
  const productId = _id || id;
  const vendorUserId = vendor_id?.user_id?._id || vendor_id?.user_id || vendor_id?._id;
  const vendorId = vendor_id?._id || vendor_id;
  
  const { user } = useAuthStore();
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(vendorId);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  
  // Variant Selection State
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [modalActionType, setModalActionType] = useState('cart'); // 'cart' or 'buy'

  // Handle both string and object image formats
  const rawImage = images && images.length > 0 ? images[0] : null;
  const mainImage = typeof rawImage === 'string' ? rawImage : (rawImage?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80');
  const numericRating = Number(rating || 0);
  const displayRating = Number.isFinite(numericRating) && numericRating > 0 ? numericRating.toFixed(1) : '';
  const storeHref = vendorId ? `/stores?id=${encodeURIComponent(vendorId)}` : '/stores';
  const productHref = productId ? `/products?id=${encodeURIComponent(productId)}` : '/products';

  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (!user) { toast.error(t('common.loginCart')); return; }
    
    // If product has variants, show selector instead of adding directly
    if (product.has_variants) {
      setModalActionType('cart');
      setIsVariantModalOpen(true);
      return;
    }

    setAddingToCart(true);
    cartStore.addItem({ ...product, price: displayPrice }, 1);
    api.post('/cart', { product_id: productId, quantity: 1 })
      .then((res) => {
        if (res.data?.success) cartStore.setCart(res.data.data.cart);
        toast.success(t('common.addedToCart', undefined, { name }), {
          icon: '🛒',
          style: {
            borderRadius: '16px',
            background: '#333',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 'bold'
          },
        });
      })
      .finally(() => setAddingToCart(false));
  };

  const handleBuyNow = (e) => {
    e.stopPropagation();
    if (!user) { toast.error(t('common.loginProceed')); return; }

    // If product has variants, show selector
    if (product.has_variants) {
      setModalActionType('buy');
      setIsVariantModalOpen(true);
      return;
    }

    // Direct Buy Now logic
    router.push(`/checkout?productId=${productId}&quantity=1`);
  };

  const handleVariantConfirm = async (variantOrProduct) => {
    // Merge parent product name/images into the variant (SKU variants don't carry them)
    const enriched = {
      ...product, // use the original product so we have sku_variants
      _id: productId,
    };

    if (modalActionType === 'buy') {
      router.push(`/checkout?productId=${productId}&quantity=1&variant=${encodeURIComponent(JSON.stringify(variantOrProduct.combination))}`);
    } else {
      setAddingToCart(true);
      cartStore.addItem(enriched, 1, variantOrProduct.combination);
      try {
        const res = await api.post('/cart', { 
          product_id: productId, 
          quantity: 1, 
          variant: variantOrProduct.combination 
        });
        if (res.data?.success) cartStore.setCart(res.data.data.cart);
        toast.success(t('common.addedToCart', undefined, { name }), {
          icon: '🛒',
          style: {
            borderRadius: '16px',
            background: '#333',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 'bold'
          },
        });
      } finally {
        setAddingToCart(false);
      }
    }
  };

  const handleWishlist = async (e) => {
    e.stopPropagation();
    if (!user) { toast.error(t('common.loginWishlist')); return; }
    setWishlistLoading(true);
    try {
      await api.post(`/wishlist/toggle/${productId}`);
      setWishlisted(!wishlisted);
      if (!wishlisted) trackWishlist(product);
    } catch { 
      toast.error(t('common.wishlistFailed'));
    } finally { 
      setWishlistLoading(false); 
    }
  };

  const { openChat } = useChat();

  const handleChat = (e) => {
    e.stopPropagation();
    if (!user) { toast.error(t('common.loginChat')); return; }
    if (vendorUserId) {
      const vName = vendor_id?.store_name || t('common.verifiedStore');
      const vLogo = vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo;
      openChat(vendorUserId, product, { 
        store_name: vName, 
        branding: { logo: vLogo } 
      });
    } else {
       // Fallback for pages without vendor context
       openChat(null);
    }
  };

  const renderCardContent = () => {
    if (layout === 'list') {
      return (
        <div 
          onClick={() => trackAction({ product_id: productId, action_type: 'view', category, vendor_id })}
          className="group relative rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-xl flex items-center gap-5 p-4 h-40 md:h-48 cursor-pointer font-poppins"
        >
          <div className="relative h-full aspect-[4/5] shrink-0 rounded-2xl overflow-hidden bg-[var(--accent)]/5">
            <BlurUpImage 
              src={mainImage} 
              alt={name} 
              className="w-full h-full" 
              imgClassName="transition-transform duration-700 group-hover:scale-105" 
            />
            <button onClick={handleWishlist} disabled={wishlistLoading} className={`absolute top-2 right-2 size-8 rounded-full flex items-center justify-center transition-all border shadow-lg backdrop-blur-xl ${wishlisted ? 'bg-red-500 text-white border-red-500' : 'bg-black/40 text-white border-white/10 hover:bg-red-500'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
            <div className="space-y-2">
               <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <Link href={storeHref} className="flex min-w-0 items-center gap-2 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="size-5 shrink-0 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                      <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
                    </div>
                    <span
                      translate="no"
                      className="block min-w-0 truncate text-[11px] lg:text-[12px] font-semibold text-[var(--accent)] tracking-normal"
                      title={vendor_id?.store_name || t('common.verifiedVendor')}
                    >
                      {vendor_id?.store_name || t('common.verifiedVendor')}
                    </span>
                  </Link>
                  {user?._id !== vendorUserId && (
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`shrink-0 whitespace-nowrap text-[11px] lg:text-[12px] font-semibold tracking-tight ${isFollowing ? 'text-emerald-500' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}>
                      {isFollowing ? t('common.following') : `+ ${t('common.follow')}`}
                    </button>
                  )}
               </div>

              <Link href={productHref} className="block">
                <h3 translate="no" className="line-clamp-2 text-xs md:text-sm font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" title={name}>{name}</h3>
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <p className="text-[14px] md:text-[18px] font-bold text-[var(--text-primary)]">{displayPrice?.toLocaleString()} XAF</p>
                  {isOnSale && displayOriginalPrice && (
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] line-through opacity-50">{displayOriginalPrice?.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-70">
                   <span className="flex items-center gap-1"><ShoppingCart className="size-3.5 text-emerald-500" /> {t('product.soldCount', '{count} sold', { count: product.purchase_count || 0 })}</span>
                </div>
              </div>
            </div>

            {/* 3 equal-size action buttons — Add to Cart primary */}
            <div className="grid grid-cols-3 items-center gap-2 mt-auto">
              {/* Add to Cart — PRIMARY */}
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || (!product.has_variants && product.stock <= 0)}
                title={t('product.addToCart', 'Add to cart')}
                aria-label={t('product.addToCart', 'Add to cart')}
                className="h-9 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center gap-1.5 text-[11px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ShoppingCart className={`size-4 shrink-0 ${addingToCart ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:block text-[10px] font-bold">Cart</span>
              </button>
              {/* Chat — ICON */}
              <button
                onClick={handleChat}
                title={t('common.chat')}
                aria-label={t('common.chat')}
                className="h-9 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all"
              >
                <MessageSquare className="size-4 shrink-0" />
              </button>
              {/* Buy Now — SECONDARY */}
              <button
                onClick={handleBuyNow}
                disabled={!product.has_variants && product.stock <= 0}
                className="h-9 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center text-[10px] sm:text-[11px] font-bold hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed px-2"
              >
                <span className="truncate">{(!product.has_variants && product.stock <= 0) ? t('common.outOfStock') : t('common.buyNow')}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    const inStock = product.has_variants ? true : (product.stock > 0);

    return (
      <div 
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            e.stopPropagation();
            onClick(product);
          } else {
            trackAction({ product_id: productId, action_type: 'view', category, vendor_id });
          }
        }}
        className={`group relative rounded-[2rem] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1.5 backdrop-blur-xl flex flex-col h-full cursor-pointer font-poppins ${!inStock ? 'grayscale-[0.5]' : ''}`}
      >
        <div className="grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-2 backdrop-blur-md sm:p-2.5 md:p-3 overflow-hidden">
           <Link href={storeHref} className="flex min-w-0 items-center gap-1.5 overflow-hidden group/vendor" onClick={e => e.stopPropagation()}>
              <div className="size-5 md:size-6 rounded-md md:rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm transition-transform group-hover/vendor:scale-105">
                <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
              </div>
               <span
                 translate="no"
                 className="block min-w-0 truncate text-[10px] sm:text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)] leading-none"
                 title={vendor_id?.store_name || t('common.verifiedNode')}
               >
                 {vendor_id?.store_name || t('common.verifiedNode')}
               </span>
              {vendor_id?.verified && <Check className="size-2.5 text-blue-500 shrink-0" />}
           </Link>
           
           {user?._id !== vendorUserId && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-semibold tracking-tight transition-all active:scale-95 shadow-sm border ${isFollowing ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'}`}>
                 {isFollowing ? t('common.following') : `+ ${t('common.follow')}`}
              </button>
           )}
        </div>

        <div className="relative aspect-square overflow-hidden bg-[var(--accent)]/5">
          <Link href={productHref} className="block h-full w-full" onClick={e => e.stopPropagation()}>
            <BlurUpImage src={mainImage} alt={name} className="w-full h-full" imgClassName="transition-transform duration-1000 group-hover:scale-110" />
          </Link>
          {/* Sale badge */}
          {isOnSale && (
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 shadow-lg">
              <span className="text-[9px] font-black uppercase tracking-wide text-white">
                {discountPercent > 0 ? `-${discountPercent}%` : '%'}
              </span>
            </div>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <span className="px-4 py-2 bg-red-500 text-white text-[11px] font-semibold tracking-tight rounded-full shadow-xl">{t('common.outOfStock')}</span>
            </div>
          )}
          <button onClick={handleWishlist} disabled={wishlistLoading} className={`absolute top-2.5 right-2.5 size-7 rounded-full flex items-center justify-center transition-all border shadow-lg backdrop-blur-xl z-20 ${wishlisted ? 'bg-red-500 text-white border-red-500' : 'bg-black/60 text-white border-white/10 hover:bg-red-500'}`}>
            <Heart className={`size-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>
          <Link href={storeHref} onClick={e => e.stopPropagation()} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl py-2 flex items-center justify-center gap-2 text-white text-[11px] font-semibold tracking-tight transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 z-20">
            <Compass className="size-3" /> {t('common.store')}
          </Link>
        </div>

        <div className="p-2 sm:p-2.5 md:p-3.5 flex flex-col flex-1 gap-2 md:gap-3">
          <div className="space-y-0.5 md:space-y-1">
            <Link href={productHref} className="block">
              <h3 translate="no" className="line-clamp-2 text-[11px] sm:text-[12px] md:text-[13px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight" title={name}>{name}</h3>
            </Link>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] sm:text-[13px] md:text-[15px] font-bold text-[var(--accent)] truncate">{displayPrice?.toLocaleString()} XAF</span>
                {isOnSale && displayOriginalPrice && (
                  <span className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-secondary)] line-through opacity-50 truncate">{displayOriginalPrice?.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-70 shrink-0">
                <Star className="size-2.5 fill-[var(--accent)] text-[var(--accent)]" />
                {displayRating && <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{displayRating}</span>}
              </div>
            </div>
          </div>
          {/* 3 equal-size action buttons — Add to Cart is primary */}
          <div className="grid grid-cols-3 items-center gap-1 md:gap-1.5 mt-auto">
            {/* Add to Cart — PRIMARY */}
            <button
              onClick={handleAddToCart}
              disabled={addingToCart || !inStock}
              title={t('product.addToCart', 'Add to cart')}
              aria-label={t('product.addToCart', 'Add to cart')}
              className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--accent)] text-white flex items-center justify-center gap-1 text-[9px] md:text-[10px] font-bold shadow-lg shadow-[var(--accent)]/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed px-1"
            >
              <ShoppingCart className={`size-3 md:size-3.5 shrink-0 ${addingToCart ? 'animate-bounce' : ''}`} />
              <span className="truncate hidden sm:block">Cart</span>
            </button>
            {/* Chat — ICON */}
            <button
              onClick={handleChat}
              title={t('common.chat')}
              aria-label={t('common.chat')}
              className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all"
            >
              <MessageSquare className="size-3.5 md:size-4 shrink-0" />
            </button>
            {/* Buy Now — SECONDARY */}
            <button
              onClick={handleBuyNow}
              disabled={!inStock}
              className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center text-[9px] md:text-[10px] font-bold hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed px-1"
            >
              <span className="truncate">{inStock ? t('common.buyNow') : t('common.outOfStock')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderCardContent()}
      
      <VariantSelectorModal 
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        product={product}
        actionType={modalActionType}
        onConfirm={handleVariantConfirm}
      />
    </>
  );
}
