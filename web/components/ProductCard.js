"use client";

import { useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingCart, Star, Plus, ShieldCheck, 
  MessageSquare, Zap, Eye, Heart, 
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

/**
 * ProductCard - Elite Nexus Version
 * Standardized premium card used across Hub and Shop.
 */
export default function ProductCard({ product, layout = 'grid', onOpenChat = null, onClick = null }) {
  const { id, _id, name, price, images, rating, vendor_id, category } = product;
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

  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (!user) { toast.error('Please login to activate cart'); return; }
    
    // If product has variants, show selector instead of adding directly
    if (product.has_variants) {
      setModalActionType('cart');
      setIsVariantModalOpen(true);
      return;
    }

    setAddingToCart(true);
    cartStore.addItem(product, 1);
    api.post('/cart', { product_id: productId, quantity: 1 })
      .then(() => {
        toast.success(`${name} added to cart`, {
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
    if (!user) { toast.error('Please login to proceed'); return; }

    // If product has variants, show selector
    if (product.has_variants) {
      setModalActionType('buy');
      setIsVariantModalOpen(true);
      return;
    }

    // Direct Buy Now logic
    window.location.href = `/checkout?productId=${productId}&quantity=1`;
  };

  const handleVariantConfirm = async (variantOrProduct) => {
    // Merge parent product name/images into the variant (SKU variants don't carry them)
    const enriched = {
      ...variantOrProduct,
      _id: variantOrProduct._id || productId,
      name: variantOrProduct.name || name,
      images: variantOrProduct.images?.length ? variantOrProduct.images : images,
    };

    if (modalActionType === 'buy') {
      window.location.href = `/checkout?productId=${productId}&quantity=1&variant=${encodeURIComponent(JSON.stringify(variantOrProduct.combination))}`;
    } else {
      setAddingToCart(true);
      cartStore.addItem(enriched, 1);
      try {
        await api.post('/cart', { 
          product_id: productId, 
          quantity: 1, 
          variant: variantOrProduct.combination 
        });
        toast.success(`${name} added to cart`, {
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
    if (!user) { alert('Please login to wishlist'); return; }
    setWishlistLoading(true);
    try {
      await api.post('/wishlist/toggle', { product_id: productId });
      setWishlisted(!wishlisted);
      if (!wishlisted) trackWishlist(product);
    } catch { 
      alert('Failed to update wishlist');
    } finally { 
      setWishlistLoading(false); 
    }
  };

  const { openChat } = useChat();

  const handleChat = (e) => {
    e.stopPropagation();
    if (!user) { alert('Please login to chat'); return; }
    if (vendorUserId) {
      const vName = vendor_id?.store_name || 'Verified Store';
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
          className="group relative rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-xl flex items-center gap-5 p-4 h-40 md:h-48 cursor-pointer"
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
               <div className="flex items-center justify-between gap-4">
                  <Link href={`/shop?vendorId=${vendorId}`} className="flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                    <div className="size-5 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                      <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--accent)] tracking-normal truncate whitespace-nowrap block flex-1">{vendor_id?.store_name || 'Verified Vendor'}</span>
                  </Link>
                  {user?._id !== vendorUserId && (
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`text-[11px] font-bold tracking-tight ${isFollowing ? 'text-emerald-500' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}>
                      {isFollowing ? 'Following' : '+ Follow'}
                    </button>
                  )}
               </div>

              <Link href={`/products/${productId}`} className="block">
                <h3 className="text-xs md:text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{name}</h3>
              </Link>
              <div className="flex items-center gap-4">
                <p className="text-[14px] md:text-[18px] font-bold text-[var(--text-primary)]">{price?.toLocaleString()} XAF</p>
                <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)] opacity-70">
                   <span className="flex items-center gap-1"><ShoppingCart className="size-3.5 text-emerald-500" /> {product.purchase_count || 0} sold</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-auto">
              <button 
                onClick={handleBuyNow} 
                disabled={!product.has_variants && product.stock <= 0}
                className="h-9 px-6 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-bold tracking-tight rounded-2xl flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {(!product.has_variants && product.stock <= 0) ? 'Out of Stock' : 'Buy Now'}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={handleChat} className="size-9 rounded-2xl bg-[var(--accent)]/5 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                  <MessageSquare className="size-4.5" />
                </button>
                <button 
                  onClick={handleAddToCart} 
                  disabled={addingToCart || (!product.has_variants && product.stock <= 0)} 
                  className="size-9 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className={`size-4.5 ${addingToCart ? 'animate-spin' : ''}`} />
                </button>
              </div>
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
        className={`group relative rounded-[2rem] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1.5 backdrop-blur-xl flex flex-col h-full cursor-pointer ${!inStock ? 'grayscale-[0.5]' : ''}`}
      >
        <div className="p-2 sm:p-2.5 md:p-3 flex items-center justify-between gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-md">
           <Link href={`/stores/${vendorId}`} className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden group/vendor" onClick={e => e.stopPropagation()}>
              <div className="size-5 md:size-6 rounded-md md:rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm transition-transform group-hover/vendor:scale-105">
                <img src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'A'}`} className="size-full object-cover" alt="" />
              </div>
              <h4 className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)] leading-none flex-1 truncate">{vendor_id?.store_name || 'Verified Node'}</h4>
              {vendor_id?.verified && <Check className="size-2.5 text-blue-500 shrink-0" />}
           </Link>
           
           {user?._id !== vendorUserId && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }} disabled={followLoading} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[7px] md:text-[11px] font-bold tracking-tight transition-all active:scale-95 shadow-sm border ${isFollowing ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'}`}>
                 {isFollowing ? 'Following' : '+ Follow'}
              </button>
           )}
        </div>

        <div className="relative aspect-square overflow-hidden bg-[var(--accent)]/5">
          <Link href={`/products/${productId}`} className="block h-full w-full" onClick={e => e.stopPropagation()}>
            <BlurUpImage src={mainImage} alt={name} className="w-full h-full" imgClassName="transition-transform duration-1000 group-hover:scale-110" />
          </Link>
          {!inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <span className="px-4 py-2 bg-red-500 text-white text-[11px] font-bold  tracking-[0.2em] rounded-full shadow-xl">Out of Stock</span>
            </div>
          )}
          <button onClick={handleWishlist} disabled={wishlistLoading} className={`absolute top-2.5 right-2.5 size-7 rounded-full flex items-center justify-center transition-all border shadow-lg backdrop-blur-xl z-20 ${wishlisted ? 'bg-red-500 text-white border-red-500' : 'bg-black/60 text-white border-white/10 hover:bg-red-500'}`}>
            <Heart className={`size-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>
          <Link href={`/shop?vendorId=${vendorId}`} onClick={e => e.stopPropagation()} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[90%] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl py-2 flex items-center justify-center gap-2 text-white text-[11px] font-bold tracking-[0.2em] transform translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 z-20">
            <Compass className="size-3" /> Discovery
          </Link>
        </div>

        <div className="p-2 sm:p-2.5 md:p-3.5 flex flex-col flex-1 gap-2 md:gap-3">
          <div className="space-y-0.5 md:space-y-1">
            <Link href={`/products/${productId}`} className="block">
              <h3 className="text-[11px] sm:text-[12px] md:text-[14px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors tracking-tight">{name}</h3>
            </Link>
            <div className="flex items-center justify-between">
              <span className="text-[12px] sm:text-[14px] md:text-[16px] font-bold text-[var(--accent)]">{price?.toLocaleString()} XAF</span>
              <div className="flex items-center gap-1 opacity-70">
                 <Star className="size-2.5 fill-[var(--accent)] text-[var(--accent)]" />
                 <span className="text-[10px] sm:text-[11px] md:text-[12px] font-bold text-[var(--text-secondary)]">{rating || '4.8'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-1.5 mt-auto">
            <button 
              onClick={handleBuyNow} 
              disabled={!inStock}
              className="flex-1 h-8 md:h-9 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[9px] md:text-[11px] font-bold tracking-tight rounded-lg md:rounded-xl hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {inStock ? 'Buy Now' : 'Sold Out'}
            </button>
            <button onClick={handleChat} className="size-8 md:size-9 rounded-lg md:rounded-xl bg-[var(--accent)]/5 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-95"><MessageSquare className="size-4 md:size-4.5" /></button>
            <button 
              onClick={handleAddToCart} 
              disabled={addingToCart || !inStock} 
              className="size-8 md:size-9 rounded-lg md:rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className={`size-4 md:size-5 ${addingToCart ? 'animate-spin' : ''}`} />
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
