"use client";

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Star, Plus, ShieldCheck, MessageSquare, Zap } from 'lucide-react';
import { trackAction } from '@/services/tracking';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { cartStore } from '@/services/cartStore';

export default function ProductCard({ product, layout = 'grid' }) {
  const { id, _id, name, price, images, rating, vendor_id, category } = product;
  const productId = _id || id;
  const vendorUserId = vendor_id?.user_id?._id || vendor_id?.user_id || vendor_id?._id;
  
  // Handle both string and object image formats
  const rawImage = images && images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80';
  const mainImage = typeof rawImage === 'string' ? rawImage : (rawImage.url || '/placeholder.png');
  
  const { user } = useAuthStore();
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      showToast("Please login first", "error");
      return;
    }

    if (!productId) {
      showToast("Product error. Try again.", "error");
      return;
    }

    setAdding(true);

    // 🔥 OPTIMISTIC BROADCAST (The "Fluent" secret)
    // We update the local store IMMEDIATELY before the network even starts
    cartStore.addItem(product, 1);
    
    // Global feedback event
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('cart-item-added', { 
         detail: { name, image: mainImage } 
       }));
    }
    
    try {
      const payload = { 
        product_id: productId.toString(), 
        quantity: 1 
      };
      
      const response = await api.post('/cart', payload);
      
      // Update with final server truth quietly
      cartStore.setCart(response.data.data.cart);
    } catch (err) {
      console.error("Cart error:", err);
      // On failure, we might want to refresh to "Correct" the optimistic count
      cartStore.refresh();
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    // Redirect to checkout with this product
    window.location.href = `/checkout?productId=${productId}&quantity=1`;
  };

  const isList = layout === 'list';

  return (
    <div 
      onClick={() => trackAction({ product_id: productId, action_type: 'view', category, vendor_id: vendor_id?._id })}
      className={`group relative rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-xl hover:shadow-[var(--accent)]/10 transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-md flex ${isList ? 'flex-row' : 'flex-col h-full'}`}
    >

      {/* Product Image Area */}
      <div className={`relative overflow-hidden bg-[var(--accent)]/5 flex-shrink-0 ${isList ? 'w-32 md:w-48 h-full min-h-[140px]' : 'aspect-square'}`}>
        <img 
          src={mainImage} 
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 via-transparent to-transparent opacity-40" />

        {/* Floating Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {category && (
            <div className="px-2 py-1 rounded-lg bg-[var(--bg-primary)]/80 backdrop-blur-md text-[8px] font-black tracking-widest text-[var(--accent)] border border-[var(--glass-border)] shadow-sm">
              {category}
            </div>
          )}
        </div>

        {/* Rating Floating */}
        {rating > 0 && (
          <div className="absolute bottom-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
             <div className="flex items-center gap-1 bg-[var(--bg-primary)]/90 backdrop-blur-xl px-2 py-1 rounded-lg border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-[9px] shadow-sm">
                <Star className="w-2.5 h-2.5 fill-[var(--accent)] text-[var(--accent)]" />
                <span>{rating.toFixed(1)}</span>
             </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`p-4 flex flex-col flex-1 ${isList ? 'justify-center gap-2' : 'gap-3'}`}>
        <div className="space-y-3">
          <Link href={`/products/${productId}`} className="block">
            <h3 className={`font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight ${isList ? 'text-sm md:text-base line-clamp-2' : 'text-xs sm:text-sm line-clamp-1'}`}>
              {name}
            </h3>
          </Link>
          
          <div className="flex items-center justify-between">
            <span className="text-sm md:text-base font-black text-[var(--text-primary)]">{price?.toLocaleString()} XAF</span>
            <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-secondary)]">
               <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-emerald-500" /> {product.purchase_count || 0}</span>
               <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[var(--accent)]" /> {product.view_count || 0}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center -mt-1">
            <Link 
              href={`/stores/${vendor_id?._id || ''}`}
              className="flex items-center gap-1.5 group/vendor"
            >
              <div className="size-4 rounded-full overflow-hidden bg-[var(--accent)]/5 border border-[var(--glass-border)]">
                <img 
                  src={vendor_id?.store?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'Aura'}&backgroundColor=var(--accent)`} 
                  className="size-full object-cover"
                  alt="Store"
                />
              </div>
              <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[80px]">
                {vendor_id?.store_name || 'Verified Node'}
              </span>
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`pt-2 flex items-center gap-2 mt-auto relative z-20 focus-within:z-30 ${isList ? 'max-w-[200px]' : ''}`}>
          <button 
            onClick={handleBuyNow}
            className="flex-1 h-9 bg-[var(--accent)] text-white text-[10px] sm:text-[9px] font-black tracking-widest rounded-xl flex items-center justify-center hover:bg-[var(--accent)]/80 transition-all shadow-lg shadow-[var(--accent)]/20 active:scale-95"
          >
            BUY NOW
          </button>
          
          <div className="flex items-center gap-1.5">
            {user?._id !== vendorUserId && (
              <Link href={`/messages?vendorId=${vendorUserId || ''}&productId=${productId}`} className="size-9 rounded-xl bg-[var(--accent)]/5 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent)]/10 transition-all">
                <MessageSquare className="size-4" />
              </Link>
            )}
            <button 
              onClick={handleAddToCart}
              disabled={adding}
              className="size-9 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-md disabled:opacity-50"
            >
              <Plus className={`size-4 ${adding ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Hidden Link for SEO/Accessibility overlay */}
      <Link href={`/products/${productId}`} className="absolute top-0 left-0 w-full h-[65%] z-0" aria-label={`View ${name}`} />
    </div>
  );
}
