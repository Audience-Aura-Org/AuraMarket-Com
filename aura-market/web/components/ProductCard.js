"use client";

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Star, Plus, ShieldCheck, MessageSquare, Zap, Eye } from 'lucide-react';
import { trackAction } from '@/services/tracking';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import cartStore from '@/services/cartStore';

export default function ProductCard({ product }) {
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
    
    // OPTIMISTIC BROADCAST (Instant UI response)
    cartStore.addItem(product, 1);

    // Global feedback event (triggers beautiful background notification)
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('cart-item-added', { 
         detail: { 
           name: product.name, 
           image: mainImage 
         } 
       }));
    }
    
    try {
      const payload = { 
        product_id: productId.toString(), 
        quantity: 1 
      };
      
      const response = await api.post('/cart', payload);
      cartStore.setCart(response.data.data.cart);
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to add to cart";
      showToast(errorMessage, "error");
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

  return (
    <div 
      onClick={() => trackAction({ product_id: productId, action_type: 'view', category, vendor_id: vendor_id?._id })}
      className="group relative rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-xl hover:shadow-[var(--accent)]/10 transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-md flex flex-col h-full"
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-[10px] font-black uppercase tracking-widest transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-500'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
        }`}>
          <span className={`size-1.5 rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          {toast.msg}
        </div>
      )}

      {/* Product Image Area */}
      <div className="relative aspect-square overflow-hidden bg-[var(--accent)]/5">
        <img 
          src={mainImage} 
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 via-transparent to-transparent opacity-40" />

        {/* Floating Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {category && (
            <div className="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)]/80 backdrop-blur-md text-[7px] font-black tracking-widest text-[var(--accent)] border border-[var(--glass-border)] shadow-sm">
              {category}
            </div>
          )}
        </div>

        {/* Rating Floating */}
        <div className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
           <div className="flex items-center gap-1 bg-[var(--bg-primary)]/90 backdrop-blur-xl px-1.5 py-0.5 rounded-md border border-[var(--glass-border)] text-[var(--text-primary)] font-bold text-[8px] shadow-sm">
              <Star className="w-2 h-2 fill-[var(--accent)] text-[var(--accent)]" />
              <span>{rating || '4.8'}</span>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-3 flex flex-col flex-1 gap-2.5 relative z-10">
        <div className="space-y-2">
          <Link href={`/products/${productId}`} className="block relative z-20">
            <h3 className="text-[11px] sm:text-[12.5px] font-black text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--accent)] transition-colors tracking-tight">
              {name}
            </h3>
          </Link>
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-[12.5px] font-black text-[var(--text-primary)]">{price?.toLocaleString()} XAF</span>
            <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-[var(--text-secondary)]">
               <span className="flex items-center gap-0.5"><ShoppingCart className="w-2.5 h-2.5 text-emerald-500" /> {product.purchase_count || 0}</span>
               <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5 text-[var(--accent)]" /> {product.view_count || 0}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center -mt-1">
            <Link 
              href={`/stores/${vendor_id?._id || ''}`}
              className="flex items-center gap-1 group/vendor"
            >
              <div className="size-3.5 rounded-full overflow-hidden bg-[var(--accent)]/5 border border-[var(--glass-border)]">
                <img 
                  src={vendor_id?.store?.logo || vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor_id?.store_name || 'Aura'}&backgroundColor=var(--accent)`} 
                  className="size-full object-cover"
                  alt="Store"
                />
              </div>
              <span className="text-[8.5px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[70px]">
                {vendor_id?.store_name || 'Verified Node'}
              </span>
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2 mt-auto relative z-20 focus-within:z-30">
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
