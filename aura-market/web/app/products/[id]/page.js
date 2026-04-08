"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ShoppingBag, Heart, Share2, Star, ShieldCheck, 
  Truck, ArrowLeft, Plus, Minus, MessageSquare, 
  Loader2, Sparkles, Filter, Shield, Zap,
  CheckCircle2, Clock, MapPin, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { trackView, trackWishlist, trackCart } from '@/services/tracking';
import ProductCard from '@/components/ProductCard';
import cartStore from '@/services/cartStore';

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [messagingVendor, setMessagingVendor] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [mode, setMode] = useState('premium'); // 'classic' or 'premium'
  const [isZoomed, setIsZoomed] = useState(false);
  const imgRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [reviewFilter, setReviewFilter] = useState('newest'); // 'newest', 'highest', 'lowest'
  const [related, setRelated] = useState([]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          const productData = res.data.data.product;
          setProduct(productData);
          api.post(`/products/${id}/view`).catch(() => {});
          trackView(productData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchProduct();
      
      api.get(`/reviews/product/${id}`)
        .then(res => setReviews(res.data.data?.reviews || []))
        .catch(() => {});
        
      api.get(`/products/${id}/related?limit=4`)
        .then(res => setRelated(res.data.data?.products || []))
        .catch(() => {});
    }
  }, [id]);

  const handleWishlist = async () => {
    if (!user) { router.push('/login'); return; }
    setWishlistLoading(true);
    try {
      const res = await api.post('/wishlist/toggle', { product_id: id });
      const isNowWishlisted = res.data.data?.wishlisted ?? !wishlisted;
      setWishlisted(isNowWishlisted);
      if (isNowWishlisted) trackWishlist(product);
    } catch { setWishlisted(prev => !prev); }
    finally { setWishlistLoading(false); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = async () => {
    if (!user) { router.push('/login'); return; }
    
    setAddingToCart(true);
    trackCart(product);
    
    // 🔥 OPTIMISTIC BROADCAST (Instant UI response)
    cartStore.addItem(product, quantity);

    // Global feedback event
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('cart-item-added', { 
         detail: { 
           name: product.name, 
           image: (product.images?.[0]?.url || product.images?.[0]) 
         } 
       }));
    }

    try {
      const response = await api.post('/cart', { product_id: id, quantity });
      
      // Update with server truth quietly
      cartStore.setCart(response.data.data.cart);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add to cart', 'error');
      cartStore.refresh();
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) { router.push('/login'); return; }
    if (!product.vendor_id) { showToast('Vendor info missing.', 'error'); return; }
    
    // Add to cart and go directly to checkout
    try {
      trackCart(product);
      cartStore.addItem(product, quantity);
      
      // Sync with server quietly
      await api.post('/cart', { product_id: id, quantity }).catch(() => {});
      
      // Go directly to checkout without creating order first
      router.push('/checkout');
    } catch (err) {
      showToast('Failed to proceed. Try again.', 'error');
    }
  };

  const handleMessageVendor = () => {
    if (!user) { router.push('/login'); return; }
    const vendorUserId = product.vendor_id?.user_id?._id || product.vendor_id?.user_id || product.vendor_id?._id;
    if (!vendorUserId) { showToast('Vendor not available.', 'error'); return; }
    router.push(`/messages?vendorId=${vendorUserId}&productId=${id}`);
  };

  const handleMouseMove = (e) => {
    if (!isZoomed || !imgRef.current) return;
    const { left, top, width, height } = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    imgRef.current.style.transformOrigin = `${x}% ${y}%`;
  };

  const filteredReviews = useMemo(() => {
    let sorted = [...reviews];
    if (reviewFilter === 'highest') sorted.sort((a,b) => b.rating - a.rating);
    if (reviewFilter === 'lowest') sorted.sort((a,b) => a.rating - b.rating);
    if (reviewFilter === 'newest') sorted.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted;
  }, [reviews, reviewFilter]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Search className="w-16 h-16 opacity-20 mb-6" />
      <h1 className="text-3xl font-black mb-6 tracking-tight uppercase">Product Not Found</h1>
      <button onClick={() => router.push('/shop')} className="px-8 py-4 bg-[var(--accent)] text-white font-black tracking-widest text-[10px] rounded-2xl uppercase transition-all hover:opacity-90 active:scale-95">Go Back to Shop</button>
    </div>
  );

  const CompactVendorCard = ({ vendor }) => {
    if (!vendor) return null;
    const storeLogo = vendor.user_id?.branding?.logo || vendor.store?.logo || vendor.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor.store_name}&backgroundColor=var(--accent)`;
    
    return (
      <div className={`mt-6 flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-4 rounded-3xl border transition-all ${
        mode === 'premium' 
          ? 'glass-panel bg-[var(--bg-primary)]/40 border-[var(--glass-border)] shadow-xl shadow-[var(--accent)]/5' 
          : 'bg-[var(--bg-primary)] border-[var(--glass-border)]'
      }`}>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-[1rem] overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--glass-border)]">
            <img 
              src={storeLogo} 
              className="w-full h-full object-cover" 
              alt={vendor.store_name} 
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold truncate text-sm text-[var(--text-primary)] leading-none">{vendor.store_name}</h4>
              {vendor.verified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] mt-1.5 opacity-80">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              <span>{vendor.rating || 0}</span>
              <span className="opacity-50 mx-1">•</span>
              <span className="truncate">Active Seller</span>
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col gap-2 shrink-0">
          <button onClick={() => router.push(`/stores/${vendor._id}`)} className="flex-1 px-4 py-2 sm:py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-[var(--accent)] hover:text-white transition-colors">
            Visit Store
          </button>
        </div>
      </div>
    );
  };

  const images = product.images?.length > 0 ? product.images : [{ url: '/placeholder.png' }];

  return (
    <div className={`min-h-screen pb-32 transition-colors duration-700 ${mode === 'premium' ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-primary)]'} text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative overflow-x-hidden`}>
      
      {toast && (
        <div className={`fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs md:text-sm font-bold transition-all animate-fade-in ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-500'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
        }`}>
          <span className={`size-2 rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          {toast.msg}
        </div>
      )}
      
      <div className="fixed bottom-24 lg:bottom-10 right-4 lg:right-10 z-[50]">
         <div className="glass-panel p-1.5 md:p-2 rounded-full border border-[var(--glass-border)] shadow-2xl flex items-center gap-1 bg-[var(--bg-primary)]/80 backdrop-blur-xl">
            <button 
              onClick={() => setMode('classic')}
              className={`px-3 md:px-5 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'classic' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
               Classic
            </button>
            <button 
              onClick={() => setMode('premium')}
              className={`px-3 md:px-5 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'premium' ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}
            >
               Premium
            </button>
         </div>
      </div>

      <main className="w-full px-4 md:px-20 py-6 md:py-10 pt-20 md:pt-24 max-w-[1400px] mx-auto relative z-10 space-y-6 md:space-y-12">
        
        <div className="flex items-center justify-between">
           <Link href="/shop" className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group uppercase">
             <ArrowLeft className="size-3.5 md:size-4 group-hover:-translate-x-1 transition-transform" />
             <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em]">{product.category_id?.name || 'Back to Products'}</span>
           </Link>
           <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={handleWishlist} 
                className={`p-2.5 md:p-3 rounded-xl transition-all border shadow-sm ${wishlisted ? 'bg-red-50 border-red-100 text-red-500 dark:bg-red-500/10 dark:border-red-500/20' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]'}`}
              >
                 <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2.5 md:p-3 rounded-xl transition-all border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] shadow-sm">
                 <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
           </div>
        </div>

        <div className={`flex flex-col lg:flex-row ${mode === 'premium' ? 'gap-16' : 'gap-12'}`}>
           
           <div className={`lg:w-[45%] flex flex-col-reverse md:flex-row gap-4`}>
              <div className="flex md:flex-col gap-3 overflow-auto no-scrollbar py-1 shrink-0">
                 {images.map((img, i) => (
                   <button 
                     key={i} 
                     onClick={() => setActiveImg(i)}
                     className={`w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-[1.2rem] overflow-hidden border-2 transition-all ${
                       activeImg === i 
                         ? 'border-[var(--accent)] shadow-md shadow-[var(--accent)]/20' 
                         : 'border-transparent opacity-60 hover:opacity-100 hover:border-[var(--glass-border)]'
                     }`}
                   >
                     <img src={img.url || img} className="w-full h-full object-cover bg-[var(--bg-secondary)]" alt={`Thumb ${i+1}`} />
                   </button>
                 ))}
              </div>
              
              <div 
                className={`w-full aspect-[4/3] md:max-h-[500px] relative overflow-hidden group border ${
                  mode === 'premium'
                    ? 'rounded-[2.5rem] glass-panel bg-[var(--bg-primary)]/50 border-[var(--glass-border)] shadow-2xl'
                    : 'rounded-[1.5rem] bg-[var(--bg-secondary)] border-transparent'
                }`}
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => { setIsZoomed(false); if(imgRef.current) imgRef.current.style.transform = 'scale(1)'; }}
                onMouseMove={handleMouseMove}
              >
                <img
                  ref={imgRef}
                  src={images[activeImg]?.url || images[activeImg]}
                  className={`w-full h-full object-cover transition-transform duration-200 ${isZoomed ? 'scale-150 cursor-zoom-in' : 'scale-100'}`}
                  alt={product.name}
                />
              </div>
           </div>

           <div className={`lg:w-[50%] flex flex-col ${mode === 'premium' ? 'justify-center' : ''}`}>
              <div className="space-y-4 mb-6">
                 <div className="flex flex-wrap gap-2">
                    {mode === 'premium' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-black uppercase tracking-widest border border-[var(--accent)]/20">
                         <Sparkles className="w-3 h-3" /> Premium Product
                      </div>
                    )}
                    {product.stock > 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                         <CheckCircle2 className="w-3 h-3" /> In Stock
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                         <Clock className="w-3 h-3" /> Out of Stock
                      </div>
                    )}
                 </div>
                 
                 <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight text-[var(--text-primary)]">
                    {product.name}
                 </h1>
                                  {(product.num_reviews > 0 || reviews.length > 0) && (
                    <div className="flex flex-wrap items-center gap-4 text-sm font-black uppercase tracking-widest">
                      <div className="flex gap-0.5 text-yellow-400">
                         {[1, 2, 3, 4, 5].map(star => (
                           <Star key={star} className={`w-4 h-4 ${(product.rating || 0) >= star ? 'fill-current' : 'opacity-30'}`} />
                         ))}
                      </div>
                      <span className="text-[var(--text-primary)]">{product.num_reviews || reviews.length} Reviews ({product.rating || 0}/5)</span>
                    </div>
                  )}
               </div>

               <div className="mb-6 pb-6 border-b border-[var(--glass-border)] flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl text-[var(--text-primary)] font-black tracking-tighter">
                       {product.price?.toLocaleString()} XAF
                    </span>
                    
                    {product.vendor_id && (
                      <Link 
                        href={`/stores/${product.vendor_id._id}`}
                        className="flex items-center gap-1.5 group/vendor"
                      >
                        <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                           <img 
                            src={product.vendor_id?.user_id?.branding?.logo || product.vendor_id?.store?.logo || product.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${product.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                            className="size-full object-cover"
                            alt="Store"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[80px]">
                          {product.vendor_id?.store_name}
                        </span>
                      </Link>
                    )}
                  </div>
               </div>

               <div className="prose prose-sm dark:prose-invert max-w-none mb-10 text-[var(--text-secondary)] font-medium leading-relaxed">
                 <p>{product.description}</p>
              </div>

              <div className={`space-y-6 ${mode === 'premium' ? 'p-6 rounded-[2.5rem] glass-panel bg-[var(--bg-primary)]/60 border border-[var(--glass-border)] shadow-xl' : ''}`}>
                 
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center justify-between px-6 h-14 sm:h-20 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl sm:rounded-[1.5rem] w-full sm:w-44 shadow-sm group/qty">
                       <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-125 transition-all"><Minus className="w-4 h-4"/></button>
                       <span className="font-black text-lg sm:text-xl tracking-tighter">{quantity}</span>
                       <button onClick={() => setQuantity(quantity + 1)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-125 transition-all"><Plus className="w-4 h-4"/></button>
                    </div>
                    
                    <button 
                      onClick={handleAddToCart}
                      disabled={addingToCart || product.stock === 0}
                      className="flex-1 h-14 sm:h-20 flex items-center justify-center gap-3 bg-[var(--accent)] text-white font-black uppercase tracking-[0.2em] text-[12px] sm:text-[13px] rounded-2xl sm:rounded-[1.5rem] hover:bg-[var(--accent)]/90 transition-all shadow-xl shadow-[var(--accent)]/20 active:scale-95 disabled:opacity-50"
                    >
                      {addingToCart ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShoppingBag className="w-6 h-6" />}
                      {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                 </div>

                  <button
                    onClick={handleBuyNow}
                    disabled={buyingNow || product.stock === 0}
                    className="w-full h-14 sm:h-20 flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[11px] sm:text-[13px] rounded-2xl sm:rounded-[1.5rem] transition-all active:scale-95 border-2 border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-transparent hover:text-[var(--text-primary)] disabled:opacity-50 shadow-lg"
                  >
                    {buyingNow ? 'Processing...' : 'Buy Now'}
                  </button>

                  <button
                    onClick={handleMessageVendor}
                    className="w-full py-2 flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all text-[9px] font-black uppercase tracking-[0.2em]"
                  >
                    <MessageSquare className="size-3" />
                    Message Seller
                  </button>
              </div>

              <div className="mt-4">
                <CompactVendorCard vendor={product.vendor_id} />
              </div>

           </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-50" />

        {product.description && (
          <div className="glass-panel bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-[2rem] p-10">
            <h3 className="text-2xl font-black mb-6 tracking-tight uppercase text-[var(--text-primary)]">Product Description</h3>
            <div className="text-[var(--text-secondary)] leading-relaxed font-medium space-y-4">
               {product.description}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-16">
           <div>
             <h3 className="text-2xl font-black mb-8 border-b border-[var(--glass-border)] pb-4 tracking-tight uppercase">Specifications</h3>
              <p className="text-[var(--text-secondary)] italic p-6 text-center border border-dashed border-[var(--glass-border)] rounded-3xl">Details provided below.</p>
           </div>
           
           <div>
             <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-4 mb-8">
               <h3 className="text-2xl font-black tracking-tight uppercase">Customer Reviews</h3>
             </div>

             <div className="space-y-6">
                {filteredReviews.length === 0 ? (
                  <div className="p-10 text-center border border-dashed border-[var(--glass-border)] rounded-3xl text-[var(--text-secondary)]">
                     <MessageSquare className="w-10 h-10 mx-auto opacity-20 mb-4" />
                     <p className="font-bold text-sm">No reviews yet.</p>
                  </div>
                ) : (
                  filteredReviews.map((r, i) => (
                    <div key={r._id || i} className="p-6 rounded-3xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] space-y-3">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="size-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] overflow-hidden">
                                {r.user_id?.avatar ? <img src={r.user_id.avatar} className="size-full object-cover" /> : <div className="flex items-center justify-center size-full text-[10px] font-black">{r.user_id?.name?.charAt(0) || 'U'}</div>}
                             </div>
                             <p className="font-black text-sm uppercase tracking-tight">{r.user_id?.name || 'Verified Buyer'}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">
                             {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                       </div>
                       <div className="flex gap-0.5 text-yellow-500">
                         {[1,2,3,4,5].map(n => <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-700'}`} />)}
                       </div>
                       <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{r.comment}</p>
                    </div>
                  ))
                )}
             </div>
           </div>
        </div>

        {related.length > 0 && (
          <div className="pt-20">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-3xl font-black tracking-tight uppercase">Related Products</h3>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
               {related.map(p => (
                 <ProductCard key={p._id} product={p} />
               ))}
             </div>
          </div>
        )}

      </main>
    </div>
  );
}
