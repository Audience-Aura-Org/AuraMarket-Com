"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShoppingCart, Star, Plus, ShieldCheck, 
  MessageSquare, Eye, Heart, 
  UserPlus, UserCheck, Compass, Check, Clock
} from 'lucide-react';
import { trackAction, trackWishlist } from '@/services/tracking';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { useFollow } from '@/hooks/useFollow';
import api from '@/services/api';
import cartStore from '@/services/cartStore';
import { toast } from 'react-hot-toast';
import VariantSelectorModal from '@/components/common/VariantSelectorModal';
import { useLanguage } from '@/context/LanguageContext';

/**
 * ProductCard - Elite Nexus Version
 * Standardized premium card used across Hub and Shop.
 */
export default function ProductCard({ product, layout = "grid", onOpenChat = null, onClick = null, vendorMinimum = 0 }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { id, _id, name, price, sale_price, images, rating, vendor_id, category } = product;
  const numericRegularPrice = Number(price || 0);
  const numericSalePrice = sale_price !== undefined && sale_price !== null ? Number(sale_price) : 0;
  const isOnSale = numericSalePrice > 0 && numericSalePrice < numericRegularPrice;
  const displayPrice = isOnSale ? numericSalePrice : numericRegularPrice;
  const displayOriginalPrice = isOnSale ? numericRegularPrice : null;
  const discountPercent = isOnSale
    ? Math.round(((numericRegularPrice - numericSalePrice) / numericRegularPrice) * 100)
    : 0;
  // Price range for variable products (WooCommerce-style "min – max")
  const variantPrices = product.has_variants && product.sku_variants?.length
    ? product.sku_variants.map(v => Number(v.price || 0)).filter(p => p > 0)
    : [];
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null;
  const maxVariantPrice = variantPrices.length ? Math.max(...variantPrices) : null;
  const isPriceRange = minVariantPrice !== null && maxVariantPrice !== null && minVariantPrice !== maxVariantPrice;
  const productId = _id || id;
  const vendorUserId = vendor_id?.user_id?._id || vendor_id?.user_id || vendor_id?._id;
  const vendorId = vendor_id?._id || vendor_id;
  const deliveryTime = vendor_id?.store?.delivery_time;
  // Read minimum order amount directly from populated product data (no extra fetch needed)
  const minimumAmount = Number(vendor_id?.store?.minimum_order_amount) || Number(vendorMinimum) || 0;

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
    if (!user) { router.push('/login?from=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
    
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
    if (!user) { router.push('/login?from=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }

    // Minimum order check — Buy Now is a single item so if price < minimum, block it
    if (minimumAmount > 0 && displayPrice < minimumAmount) {
      const storeName = vendor_id?.store_name || 'this store';
      const needed = minimumAmount - displayPrice;
      toast(`Minimum order: ${minimumAmount.toLocaleString()} XAF for ${storeName}. Add ${needed.toLocaleString()} XAF more to cart first.`, {
        icon: '⚠️',
        duration: 4000,
        style: { borderRadius: '16px', background: '#333', color: '#fff', fontSize: '12px', fontWeight: 'bold' },
      });
      return;
    }

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
      const variantPrice = variantOrProduct.price ?? displayPrice;
      if (minimumAmount > 0 && variantPrice < minimumAmount) {
        const storeName = vendor_id?.store_name || 'this store';
        toast(`Minimum order: ${minimumAmount.toLocaleString()} XAF for ${storeName}. Add more items to cart first.`, {
          icon: '⚠️',
          duration: 4000,
          style: { borderRadius: '16px', background: '#333', color: '#fff', fontSize: '12px', fontWeight: 'bold' },
        });
        setIsVariantModalOpen(false);
        return;
      }
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
    if (!user) { router.push('/login?from=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
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
    if (!user) { router.push('/login?from=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
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
          className="group relative min-w-0 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm hover:border-[var(--accent)]/30 hover:shadow-md transition-[color,background-color,border-color,box-shadow] duration-150 overflow-hidden flex items-start gap-3 p-3 sm:gap-4 sm:p-4 cursor-pointer font-poppins [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-[var(--accent)] [&_a]:focus-visible:outline-offset-[-2px] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-[var(--accent)] [&_button]:focus-visible:outline-offset-[-2px] [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-[var(--accent)]"
        >
          <div className="relative w-20 sm:w-36 aspect-[4/3] shrink-0 rounded-2xl overflow-hidden bg-[var(--accent)]/5">
            <img
              src={mainImage} 
              alt={name} 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-product.svg'; }}
            />
            <button aria-label="Wishlist" onClick={handleWishlist} disabled={wishlistLoading} className={`absolute top-2 right-2 size-9 rounded-full flex items-center justify-center transition-[color,background-color,border-color,box-shadow] duration-150 border shadow-sm ${wishlisted ? 'bg-red-500 text-white border-red-500' : 'bg-black/40 text-white border-white/10 hover:bg-red-500'}`}>
              <Heart className={`size-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
            <div className="space-y-2 mb-3">
               <div className="flex flex-wrap min-w-0 items-center gap-2">
                  <Link href={storeHref} className="flex min-w-0 items-center gap-2 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="size-5 shrink-0 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                      <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
                    </div>
                    <span
                      translate="no"
                      className="block min-w-0 truncate text-[10px] font-semibold text-[var(--text-secondary)] tracking-normal"
                      title={vendor_id?.store_name || t('common.verifiedVendor')}
                    >
                      {vendor_id?.store_name || t('common.verifiedVendor')}
                    </span>
                  </Link>
                  {user?._id !== vendorUserId && (
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`shrink-0 whitespace-nowrap text-[10px] font-semibold tracking-tight ${isFollowing ? 'text-emerald-500' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}>
                      {isFollowing ? t('common.following') : `+ ${t('common.follow')}`}
                    </button>
                  )}
               </div>

              <Link href={productHref} className="block">
                <h3 translate="no" className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" title={name}>{name}</h3>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  <p className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] [overflow-wrap:anywhere]">
                    {isPriceRange
                    ? <>{minVariantPrice.toLocaleString()} {'\u2013'} <wbr />{maxVariantPrice.toLocaleString()}</>
                    : displayPrice?.toLocaleString()}{' '}
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span>
                  </p>
                  {!isPriceRange && isOnSale && displayOriginalPrice && (
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] line-through tabular-nums [overflow-wrap:anywhere]">{displayOriginalPrice?.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
                   <span className="flex items-center gap-1 text-[10px]"><ShoppingCart className="size-3.5 text-emerald-500" /> {t('product.soldCount', '{count} sold', { count: product.purchase_count || 0 })}</span>
                  {deliveryTime && (
                     <span className="flex items-center gap-1 text-[9px] opacity-70"><Clock className="size-2.5 text-[var(--text-secondary)]" /> Delivery in {deliveryTime}</span>
                   )}
                </div>
              </div>
            </div>

            {/* 3 equal-size action buttons — Add to Cart primary */}
            <div className="grid grid-cols-3 items-center gap-1 mt-auto">
              {/* Add to Cart — PRIMARY */}
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || (!product.has_variants && product.stock <= 0)}
                title={t('product.addToCart', 'Add to cart')}
                aria-label={t('product.addToCart', 'Add to cart')}
                className="h-9 rounded-xl sm:rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center gap-1.5 text-[10px] font-semibold shadow-sm shadow-[var(--accent)]/20 hover:brightness-110 transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus strokeWidth={3} className={`size-4 shrink-0 ${addingToCart ? 'animate-spin' : ''}`} />
              </button>
              {/* Chat — ICON */}
              <button
                onClick={handleChat}
                title={t('common.chat')}
                aria-label={t('common.chat')}
                className="h-9 rounded-xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150"
              >
                <MessageSquare className="size-4 shrink-0" />
              </button>
              {/* Buy Now — SECONDARY */}
              <button
                onClick={handleBuyNow}
                aria-label="Buy now"
                title="Buy now"
                disabled={!product.has_variants && product.stock <= 0}
                className="h-9 rounded-xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed px-2"
              >
                <ShoppingCart className="size-3.5 sm:size-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    const inStock = product.has_variants ? true : (product.stock > 0);
    const purchasable = inStock;

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
        className={`group relative min-w-0 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm hover:border-[var(--accent)]/30 hover:shadow-md transition-[color,background-color,border-color,box-shadow] duration-150 overflow-hidden flex flex-col h-full cursor-pointer font-poppins [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-[var(--accent)] [&_a]:focus-visible:outline-offset-[-2px] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-[var(--accent)] [&_button]:focus-visible:outline-offset-[-2px] [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-[var(--accent)] ${!purchasable ? 'grayscale-[0.5]' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 px-3 py-2.5 sm:px-4 overflow-hidden">
           <Link href={storeHref} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden group/vendor" onClick={e => e.stopPropagation()}>
              <div className="size-5 md:size-6 rounded-md md:rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm transition-[color,background-color,border-color,box-shadow] duration-150 ">
                <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
              </div>
               <span
                 translate="no"
                 className="block min-w-0 truncate text-[10px] font-semibold text-[var(--text-primary)] leading-none"
                 title={vendor_id?.store_name || t('common.verifiedNode')}
               >
                 {vendor_id?.store_name || t('common.verifiedNode')}
               </span>
              {vendor_id?.verified && <Check className="size-2.5 text-blue-500 shrink-0" />}
           </Link>
           
           {user?._id !== vendorUserId && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] duration-150 shadow-sm border ${isFollowing ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'}`}>
                 {isFollowing ? t('common.following') : `+ ${t('common.follow')}`}
              </button>
           )}
        </div>

        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--accent)]/5">
          <Link href={productHref} className="block h-full w-full" onClick={e => e.stopPropagation()}>
            <img
              src={mainImage}
              alt={name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-product.svg'; }}
            />
          </Link>
          {/* Sale badge */}
          {isOnSale && (
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 shadow-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white">
                {discountPercent > 0 ? `-${discountPercent}%` : '%'}
              </span>
            </div>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <span className="px-4 py-2 bg-red-500 text-white text-[10px] font-semibold tracking-tight rounded-full shadow-sm">{t('common.outOfStock')}</span>
            </div>
          )}
          <button aria-label="Wishlist" onClick={handleWishlist} disabled={wishlistLoading} className={`absolute top-2.5 right-2.5 size-9 rounded-full flex items-center justify-center transition-[color,background-color,border-color,box-shadow] duration-150 border shadow-sm z-20 ${wishlisted ? 'bg-red-500 text-white border-red-500' : 'bg-black/60 text-white border-white/10 hover:bg-red-500'}`}>
            <Heart className={`size-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>
          <Link href={storeHref} onClick={e => e.stopPropagation()} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl min-h-9 py-2 flex items-center justify-center gap-2 text-[var(--text-primary)] text-[10px] font-semibold tracking-tight opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 z-20">
            <Compass className="size-3" /> {t('common.store')}
          </Link>
        </div>

        <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2 md:gap-3">
          <div className="space-y-0.5 md:space-y-1">
            <Link href={productHref} className="block">
              <h3 translate="no" className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight" title={name}>{name}</h3>
            </Link>
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <div className="flex flex-1 flex-wrap items-baseline gap-1.5 min-w-0">
                <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] [overflow-wrap:anywhere]">
                  {isPriceRange
                    ? <>{minVariantPrice.toLocaleString()} {'\u2013'} <wbr />{maxVariantPrice.toLocaleString()}</>
                    : displayPrice?.toLocaleString()}{' '}
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span>
                </span>
                {!isPriceRange && isOnSale && displayOriginalPrice && (
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] line-through tabular-nums [overflow-wrap:anywhere]">{displayOriginalPrice?.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-70 shrink-0">
                <Star className="size-2.5 fill-[var(--accent)] text-[var(--accent)]" />
                {displayRating && <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{displayRating}</span>}
              </div>
            </div>
          </div>
          {deliveryTime && (
            <span className="flex items-center gap-1 text-[9px] font-normal text-[var(--text-secondary)] opacity-70">
              <Clock className="size-2.5 text-[var(--text-secondary)] shrink-0" />
              <span className="truncate text-[9px]">Delivery in {deliveryTime}</span>
            </span>
          )}
          {/* 3 equal-size action buttons — Add to Cart is primary */}
          <div className="grid grid-cols-3 items-center gap-1 md:grid-cols-3 md:gap-1.5 mt-auto">
            {/* Add to Cart — PRIMARY */}
            <button
              onClick={handleAddToCart}
              disabled={addingToCart || !purchasable}
              title={t('product.addToCart', 'Add to cart')}
              aria-label={t('product.addToCart', 'Add to cart')}
              className="h-9 rounded-lg md:rounded-xl bg-[var(--accent)] text-white flex items-center justify-center gap-1 text-[10px] font-semibold shadow-sm shadow-[var(--accent)]/25 hover:brightness-110 transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed px-1"
            >
              <Plus strokeWidth={3} className={`size-3 md:size-3.5 shrink-0 ${addingToCart ? 'animate-spin' : ''}`} />
            </button>
            {/* Chat — ICON */}
            <button
              onClick={handleChat}
              title={t('common.chat')}
              aria-label={t('common.chat')}
              className="h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150"
            >
              <MessageSquare className="size-3.5 md:size-4 shrink-0" />
            </button>
            {/* Buy Now — SECONDARY */}
            <button
              onClick={handleBuyNow}
              aria-label="Buy now"
              title="Buy now"
              disabled={!purchasable}
              className="h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed px-2"
            >
              <ShoppingCart className="size-3 md:size-3.5 shrink-0" />
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
