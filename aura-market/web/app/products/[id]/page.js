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
               <span>Root</span> <span>/</span> <span>{product.category_id?.name}</span>
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
          <div className="lg:col-span-5 flex gap-8">
            <div className="flex flex-col gap-3 shrink-0">
              {images.map((img, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImg(i)}
                  className={`w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] transition-all p-1.5 border ${
                    activeImg === i ? 'border-[var(--text-primary)] opacity-100' : 'border-transparent opacity-30 hover:opacity-100'
                  }`}
                >
                  <img src={img.url || img} className="w-full h-full object-contain" alt="" />
                </button>
              ))}
            </div>
            <div className="flex-1 bg-[var(--bg-secondary)] rounded-[2.5rem] p-12 md:p-16 flex items-center justify-center border border-[var(--glass-border)] group shadow-sm">
               <img src={mainImage} alt="" className="max-w-full max-h-[440px] object-contain transition-transform duration-1000 group-hover:scale-105" />
            </div>
          </div>

          {/* Product Profile */}
          <div className="lg:col-span-4 flex flex-col gap-12">
            <div className="space-y-6">
               <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.35em] text-[var(--accent)] bg-[var(--accent)]/5 px-3 py-1 rounded-full">Validated Asset</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] leading-[0.9] tracking-tighter uppercase">
                  {product.name}
               </h1>
               <div className="flex items-center gap-6">
                  <p className="text-2xl font-black">{product.price?.toLocaleString()} <span className="text-xs font-bold opacity-30">XAF</span></p>
                  <div className="flex items-center gap-1">
                     <Star className="size-2.5 fill-current" />
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{product.rating || '4.8'}</span>
                  </div>
               </div>
            </div>

            <div className="prose prose-sm font-medium text-[var(--text-secondary)] leading-relaxed">
               {product.description || 'Verified product metadata and merchant identity records active for this node. All specifications are audited for material integrity.'}
            </div>

            {/* Specifications (Compact Integration) */}
            <div className="grid grid-cols-1 gap-y-4 border-t border-[var(--glass-border)] pt-8">
               {[
                 { l: 'Origin', v: product.vendor_id?.store_name },
                 { l: 'Category', v: product.category_id?.name },
                 { l: 'Protocol', v: 'Aura Signature' },
                 { l: 'Inventory', v: `${product.stock} Units` }
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">{item.l}</span>
                    <span className="text-[10px] font-black uppercase tracking-tight">{item.v}</span>
                 </div>
               ))}
            </div>

            {/* Merchant Identity */}
            <Link href={`/stores/${product.vendor_id?._id}`} className="flex items-center gap-4 p-5 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--text-primary)] transition-all group">
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
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="lg:sticky lg:top-[140px] space-y-6">
               <div className="bg-[var(--bg-primary)] border border-[var(--text-primary)] rounded-[2.5rem] p-8 shadow-2xl shadow-black/10 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Units</span>
                    <div className="flex items-center gap-4 bg-[var(--bg-secondary)] px-4 py-1.5 rounded-full">
                       <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="hover:scale-110 active:scale-95 transition-transform"><Minus className="size-3.5" /></button>
                       <span className="text-sm font-black w-4 text-center">{quantity}</span>
                       <button onClick={() => setQuantity(quantity + 1)} className="hover:scale-110 active:scale-95 transition-transform"><Plus className="size-3.5" /></button>
                    </div>
                  </div>

                  <div className="space-y-3">
                     <button onClick={handleBuyNow} className="w-full h-14 bg-[var(--text-primary)] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Zap className="size-4 fill-current" /> Checkout
                     </button>
                     <button onClick={handleAddToCart} className="w-full h-14 bg-transparent border-2 border-[var(--text-primary)] text-[var(--text-primary)] text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-[var(--text-primary)] hover:text-white transition-all flex items-center justify-center gap-2">
                        {addingToCart ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                        Move to Stash
                     </button>
                  </div>
               </div>

               <div className="flex flex-col gap-4 px-4 text-[9px] font-bold text-[var(--text-secondary)]/50 uppercase tracking-[0.2em]">
                  <div className="flex items-center gap-3"><Truck className="size-3.5" /> Global Dispatch Active</div>
                  <div className="flex items-center gap-3"><Shield className="size-3.5" /> Inspection Protection</div>
               </div>
            </div>
          </div>
        </div>

        {/* Technical Registry */}
        <div className="mt-20 pt-10 border-t border-[var(--glass-border)]">
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {[
                { l: 'Asset ID', v: id.slice(-8).toUpperCase() },
                { l: 'Registry', v: 'ECC-256' },
                { l: 'Integrity', v: 'Audited' },
                { l: 'Logistics', v: 'Tier-1' },
                { l: 'Material', v: 'Premium' },
                { l: 'Merchant', v: product.vendor_id?.store_name }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                   <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30">{item.l}</p>
                   <p className="text-[10px] font-black uppercase truncate">{item.v}</p>
                </div>
              ))}
           </div>
        </div>

        {/* Discovery Stream */}
        {related && related.length > 0 && (
          <div className="mt-24">
             <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">Related discovery</h2>
                <Link href="/shop" className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-2 transition-all">Explore All <ArrowUpRight className="size-3" /></Link>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {related.map(p => (
                   <div key={p._id} className="opacity-80 hover:opacity-100 transition-all">
                      <ProductCard product={p} />
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Mobile Control Anchor */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-gray-100 p-5 flex gap-4 shadow-xl">
         <button onClick={handleAddToCart} className="flex-1 h-14 bg-white border border-gray-900 text-gray-900 text-[10px] font-black uppercase rounded-2xl">Add to Stash</button>
         <button onClick={handleBuyNow} className="flex-[2] h-14 bg-gray-900 text-white text-[10px] font-black uppercase rounded-2xl">Checkout Now</button>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
