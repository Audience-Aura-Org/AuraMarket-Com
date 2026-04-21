"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ShoppingBag, Heart, Share2, Star, 
  Truck, ArrowLeft, Plus, Minus, MessageCircle, 
  Loader2, Shield, RefreshCw, Store, 
  ChevronRight, ArrowUpRight, CircleCheck, Zap,
  ShoppingCart
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { trackView } from '@/services/tracking';
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
  const [related, setRelated] = useState([]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          const productData = res.data.data.product;
          setProduct(productData);
          trackView(productData);
          
          // Fetch related assets in parallel
          api.get(`/products/${id}/related?limit=6`)
            .then(res => setRelated(res.data.data?.products || []))
            .catch(() => {});
        }
      } catch (err) { } finally { setLoading(false); }
    };
    if (id) fetchProduct();
  }, [id]);

  const handleWishlist = async () => {
    if (!user) return router.push('/login');
    setWishlistLoading(true);
    try {
      const res = await api.post('/wishlist/toggle', { product_id: id });
      setWishlisted(res.data.data?.wishlisted);
    } catch { } finally { setWishlistLoading(false); }
  };

  const handleAddToCart = async () => {
    if (!user) return router.push('/login');
    setAddingToCart(true);
    try {
      cartStore.addItem(product, quantity);
      const res = await api.post('/cart', { product_id: id, quantity });
      cartStore.setCart(res.data.data.cart);
    } catch { } finally { setAddingToCart(false); }
  };

  const handleBuyNow = async () => {
    if (!user) return router.push('/login');
    setBuyingNow(true);
    try {
      cartStore.addItem(product, quantity);
      await api.post('/cart', { product_id: id, quantity });
      router.push('/checkout');
    } catch { setBuyingNow(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-10 h-10 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)]">
      <h1 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Asset ID: Not Resolved</h1>
      <button onClick={() => router.push('/shop')} className="mt-8 text-[11px] font-black underline underline-offset-4">Browse Index</button>
    </div>
  );

  const images = product.images?.length > 0 ? product.images : [{ url: '/placeholder.png' }];
  const mainImage = images[activeImg]?.url || images[activeImg];

  const specs = product.specifications ? product.specifications.split('\n').filter(s => s.trim()) : [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Poppins,sans-serif] selection:bg-[var(--accent)] selection:text-white">
      
      {/* ── Precision Bar ── */}
      <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]">
        <div className="max-w-[1700px] mx-auto px-6 h-10 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <button onClick={() => router.back()} className="text-[8.5px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-all">
              <ArrowLeft className="size-3" strokeWidth={3} /> Return
            </button>
            <div className="hidden md:flex items-center gap-2 text-[8px] font-black opacity-20 uppercase tracking-[0.2em]">
               <span>Root</span> <span>/</span> <span>{product.category}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={handleWishlist} className={`text-[8.5px] font-black uppercase tracking-widest transition-all ${wishlisted ? 'text-[var(--accent)]' : 'opacity-40 hover:opacity-100'}`}>
              Save
            </button>
            <button className="text-[8.5px] font-black uppercase tracking-widest opacity-40 hover:opacity-100">Share</button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-20">
          
          {/* Gallery Control (Compact) */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-[var(--bg-secondary)] rounded-[2.5rem] p-12 md:p-16 flex items-center justify-center border border-[var(--glass-border)] group shadow-sm overflow-hidden min-h-[400px]">
               <img src={mainImage} alt="" className="max-w-full max-h-[440px] object-contain transition-transform duration-1000 group-hover:scale-105" />
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {images.map((img, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImg(i)}
                  className={`w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] transition-all p-2 border-2 ${
                    activeImg === i ? 'border-[var(--accent)] opacity-100' : 'border-transparent opacity-40 hover:opacity-100'
                  }`}
                >
                  <img src={img.url || img} className="w-full h-full object-contain" alt="" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Profile */}
          <div className="lg:col-span-4 flex flex-col gap-10">
            <div className="space-y-6">
               <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.35em] text-[var(--accent)] bg-[var(--accent)]/5 px-3 py-1 rounded-full border border-[var(--accent)]/10">Validated Asset</span>
                  {product.featured && (
                    <span className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-500 bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10 flex items-center gap-1">
                      <Star className="size-2 fill-current" /> Featured
                    </span>
                  )}
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] leading-[0.9] tracking-tighter uppercase">
                  {product.name}
               </h1>
               <div className="flex items-center gap-6">
                  <p className="text-2xl font-black">{product.price?.toLocaleString()} <span className="text-xs font-bold opacity-30">XAF</span></p>
                  <div className="flex items-center gap-1 text-amber-500">
                     <Star className="size-3 fill-current" />
                     <span className="text-[10px] font-black uppercase tracking-widest">{product.rating || '4.8'}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
              <div className="prose prose-sm font-medium text-[var(--text-secondary)] leading-relaxed text-sm">
                 {product.description}
              </div>

              {product.long_description && (
                <div className="pt-6 border-t border-[var(--glass-border)]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-4">Detailed Intel</h4>
                  <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                    {product.long_description}
                  </p>
                </div>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, i) => (
                    <span key={tag} className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--glass-border)] opacity-60">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Merchant Identity */}
            <Link href={`/stores/${product.vendor_id?._id}`} className="flex items-center gap-4 p-5 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--text-primary)] transition-all group mt-4">
               <div className="size-10 rounded-xl bg-white border border-[var(--glass-border)] overflow-hidden p-1 shadow-sm">
                  <img src={product.vendor_id?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${product.vendor_id?.store_name}`} alt="" className="w-full h-full object-contain rounded-lg" />
               </div>
               <div className="flex-1">
                  <p className="text-[11px] font-black uppercase tracking-tight">{product.vendor_id?.store_name}</p>
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]">Verified Vendor Node</p>
               </div>
               <ArrowUpRight className="size-4 opacity-20 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Transaction Console */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-[140px] space-y-6">
               <div className="bg-[var(--bg-primary)] border border-[var(--text-primary)] rounded-[2.5rem] p-8 shadow-2xl shadow-black/10 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Batch Size</span>
                    <div className="flex items-center gap-4 bg-[var(--bg-secondary)] px-4 py-1.5 rounded-full">
                       <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="hover:scale-110 active:scale-95 transition-transform"><Minus className="size-3.5" /></button>
                       <span className="text-sm font-black w-4 text-center">{quantity}</span>
                       <button onClick={() => setQuantity(quantity + 1)} className="hover:scale-110 active:scale-95 transition-transform"><Plus className="size-3.5" /></button>
                    </div>
                  </div>

                  <div className="space-y-3">
                     <button onClick={handleBuyNow} disabled={buyingNow} className="w-full h-14 bg-[var(--text-primary)] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        {buyingNow ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 fill-current" />} Checkout
                     </button>
                     <button onClick={handleAddToCart} disabled={addingToCart} className="w-full h-14 bg-transparent border-2 border-[var(--text-primary)] text-[var(--text-primary)] text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-[var(--text-primary)] hover:text-white transition-all flex items-center justify-center gap-2">
                        {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                        Move to Stash
                     </button>
                  </div>

                  {product.stock <= 5 && product.stock > 0 && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center animate-pulse">Low Inventory: Only {product.stock} remaining</p>
                  )}
               </div>

               <div className="grid grid-cols-1 gap-4 px-4">
                  <div className="flex items-center gap-3 text-[9px] font-black text-[var(--text-secondary)]/60 uppercase tracking-[0.2em]">
                    <Truck className="size-4" /> Global Dispatch Active
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-black text-[var(--text-secondary)]/60 uppercase tracking-[0.2em]">
                    <Shield className="size-4" /> Inspection Protection
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-black text-[var(--text-secondary)]/60 uppercase tracking-[0.2em]">
                    <RefreshCw className="size-4" /> Secure Protocol
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Technical Sheets ── */}
        <div className="mt-24 pt-16 border-t border-[var(--glass-border)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Field Specifications */}
            <div className="lg:col-span-8">
              <div className="flex items-center gap-3 mb-10">
                <div className="p-2 rounded-xl bg-[var(--text-primary)] text-white shadow-lg"><Plus className="size-4" /></div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Asset Specifications</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {specs.length > 0 ? specs.map((spec, i) => {
                  const [label, ...valueParts] = spec.split(':');
                  const value = valueParts.join(':').trim();
                  return (
                    <div key={i} className="flex flex-col gap-2 pb-4 border-b border-[var(--glass-border)]/50 group hover:border-[var(--accent)]/30 transition-all">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">{label.trim()}</span>
                      <span className="text-sm font-bold tracking-tight group-hover:translate-x-1 transition-transform">{value || 'Verified Spec'}</span>
                    </div>
                  );
                }) : (
                  <>
                    <div className="flex flex-col gap-2 pb-4 border-b border-[var(--glass-border)]/50">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">Material Composition</span>
                      <span className="text-sm font-bold tracking-tight uppercase">Premium Tier Component</span>
                    </div>
                    <div className="flex flex-col gap-2 pb-4 border-b border-[var(--glass-border)]/50">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">Build Standard</span>
                      <span className="text-sm font-bold tracking-tight uppercase">Industrial Protocol 0.8</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Technical Registry / Protocol Details */}
            <div className="lg:col-span-4 bg-[var(--bg-secondary)] rounded-[2.5rem] p-10 border border-[var(--glass-border)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mb-8">Technical Registry</h3>
              <div className="space-y-6">
                {[
                  { l: 'Asset ID', v: id.slice(-12).toUpperCase() },
                  { l: 'Protocol', v: 'Aura Signature v2.1' },
                  { l: 'Registry', v: 'ECC-256 Distributed' },
                  { l: 'Category', v: product.category },
                  { l: 'Inventory', v: `${product.stock} Live Units` },
                  { l: 'Mint Date', v: new Date(product.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
                  { l: 'Logistics', v: 'Tier-1 Priority' },
                  { l: 'Integrity', v: 'Audited & Verified' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30 group-hover:opacity-100 transition-opacity">{item.l}</span>
                    <span className="text-[10px] font-black uppercase tracking-tight border-b border-transparent group-hover:border-[var(--text-primary)] transition-all">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Products */}
        {related && related.length > 0 && (
          <div className="mt-32">
             <div className="flex items-center justify-between mb-12">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Recommended products</h2>
                  <p className="text-[10px] font-black tracking-[0.3em] opacity-30 uppercase">Based on your current discovery node</p>
                </div>
                <Link href="/shop" className="h-10 px-6 border-2 border-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--text-primary)] hover:text-white flex items-center gap-2 transition-all rounded-full">Explore More</Link>
             </div>
             <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {related.map(p => (
                   <div key={p._id} className="h-full">
                      <ProductCard product={p} />
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Mobile Control Anchor */}
      <div className="lg:hidden fixed bottom-1 rounded-t-3xl inset-x-0 z-50 bg-white/80 backdrop-blur-3xl border-t border-gray-100 p-6 flex gap-4 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
         <button onClick={handleAddToCart} className="flex-1 h-14 bg-white border-2 border-gray-900 text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-2xl">Stash</button>
         <button onClick={handleBuyNow} className="flex-[2] h-14 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2">
           <Zap className="size-4 fill-current" /> Checkout
         </button>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
