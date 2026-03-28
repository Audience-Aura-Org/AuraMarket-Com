"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Star, MapPin, Package, Users, Filter, LayoutGrid, List, ShieldCheck, Heart, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export default function StorePage() {
  const { id } = useParams();
  const productsAnchor = useRef(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [activeTab, setActiveTab] = useState('Signal Intake');

  const handlePageChange = (p) => {
    setPage(p);
    productsAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    setPage(1);
  }, [id]);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        if (page === 1) setLoading(true);
        else setProductsLoading(true);

        // 1. Fetch Store Details (only on first page)
        if (page === 1) {
          const storeRes = await api.get(`/vendors/stores/${id}`);
          if (storeRes.data.success) {
            const s = storeRes.data.data.store;
            setStore(s);
            setFollowersCount(s.vendor_id?.follower_count || 0);
          }
        }

        // 2. Fetch Store's Products
        let sortParam = '-createdAt';
        if (activeTab === 'Signal Intake') sortParam = '-createdAt'; // Popularity/Default
        else if (activeTab === 'Latest Drops') sortParam = '-createdAt';
        else if (activeTab === 'Catalogs') sortParam = 'category';

        const productsRes = await api.get(`/products`, { params: { vendor_id: id, page, limit: 20, sort: sortParam }});
        if (productsRes.data.success) {
          setProducts(productsRes.data.data.products);
          setTotalPages(productsRes.data.pagination?.pages || 1);
        }

        // 3. Check follow status if logged in (only on first page)
        if (page === 1) {
          try {
             const followRes = await api.get(`/vendors/${id}/follow-status`);
             if (followRes.data.success) setIsFollowing(followRes.data.is_following);
          } catch { /* Silent if not logged in */ }
        }

      } catch (error) {
        console.error("Store Page Fetch Error:", error);
      } finally {
        setLoading(false);
        setProductsLoading(false);
      }
    };

    if (id) fetchStoreData();
  }, [id, page, activeTab]);

  const handleToggleFollow = async () => {
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const res = await api.delete(`/vendors/${id}/follow`);
        if (res.data.success) {
          setIsFollowing(false);
          setFollowersCount(res.data.follower_count);
          toast.success('Disconnected from node network.');
        }
      } else {
        const res = await api.post(`/vendors/${id}/follow`);
        if (res.data.success) {
          setIsFollowing(true);
          setFollowersCount(res.data.follower_count);
          toast.success('Synchronized with vendor updates.');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Biometric handshake failed.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center text-center px-6">
        <div className="size-24 bg-[var(--accent)]/10 text-[var(--accent)] rounded-[32px] flex items-center justify-center mb-6 border border-[var(--accent)]/20 shadow-xl">
          <span className="material-symbols-outlined text-4xl">store_off</span>
        </div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] mb-2 uppercase tracking-tighter">Store not found</h1>
        <p className="text-[var(--text-secondary)] max-w-md font-medium">The store you are looking for might have moved or no longer exists in our registry.</p>
        <button onClick={() => window.history.back()} className="mt-8 px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl font-bold text-sm hover:opacity-90 transition-all">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative overflow-x-hidden transition-colors duration-500">
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full -z-0"></div>
      <div className="fixed bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-[var(--accent-light)]/5 blur-[100px] rounded-full -z-0"></div>

       <section className="relative h-[300px] md:h-[400px] w-full overflow-hidden">
        <img 
          src={store.banner || store.vendor_id?.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070'} 
          className="w-full h-full object-cover brightness-75 transition-transform duration-[3s] hover:scale-105"
          alt="Store Banner"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-transparent" />
      </section>

      <div className="w-full px-4 md:px-6 relative z-10 -mt-20 md:-mt-32">
        <div className="glass-panel rounded-3xl md:rounded-[48px] p-6 md:p-12 border border-[var(--glass-border)] shadow-2xl bg-[var(--bg-primary)]/80 backdrop-blur-3xl">
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-center md:items-start text-center md:text-left">
            <div className="size-24 md:size-44 rounded-[28px] md:rounded-[40px] border-4 md:border-8 border-[var(--bg-primary)] overflow-hidden shadow-2xl relative group shrink-0 bg-[var(--bg-secondary)]">
               <img 
                src={store.logo || store.vendor_id?.user_id?.branding?.logo || store.vendor_id?.user_id?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(store.vendor_id?.store_name || 'Store')}&background=random&size=200`} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                alt={store.vendor_id?.store_name}
              />
            </div>

            <div className="flex-1 space-y-4 md:space-y-5 w-full">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
                <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-[var(--text-primary)] md:mb-1 uppercase">
                  {store.vendor_id?.store_name}
                </h1>
                <div className="flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-black text-[10px] md:text-xs tracking-widest shadow-sm">
                  <Star className="size-3 md:size-3 fill-current" />
                  {store.vendor_id?.rating?.toFixed(1) || '4.9'}
                </div>
                {store.vendor_id?.verified && (
                  <div className="size-6 md:size-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <ShieldCheck className="size-4 md:size-5" />
                  </div>
                )}
              </div>

              <p className="text-[var(--text-secondary)] text-sm md:text-lg max-w-3xl font-medium leading-relaxed mx-auto md:mx-0">
                {store.vendor_id?.description || "Verified Marketplace Node. Curated premium products with unprecedented quality in every item."}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-10 pt-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-[var(--accent)]/5 flex items-center justify-center text-[var(--accent)] border border-[var(--glass-border)]">
                    <Package className="size-4 md:size-5" />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)] font-black text-sm md:text-base pr-1">{products.length}</span> Objects
                  </p>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-[var(--accent)]/5 flex items-center justify-center text-[var(--accent)] border border-[var(--glass-border)]">
                    <Users className="size-4 md:size-5" />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)] font-black text-sm md:text-base pr-1">{followersCount.toLocaleString()}</span> Followers
                  </p>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-600 border border-emerald-500/10">
                    <ShieldCheck className="size-4 md:size-5" />
                  </div>
                  <p className="text-[10px] md:text-sm font-black text-[var(--text-secondary)] tracking-tight uppercase">Nexus Escrow</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex items-center justify-center md:justify-start gap-2 md:gap-4 pt-4 md:pt-6 w-full">
                 <button 
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`h-12 md:h-14 px-2 md:px-12 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 md:gap-3 w-full md:w-auto ${
                    isFollowing 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white' 
                    : 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20 hover:opacity-90'
                  }`}
                 >
                    {followLoading ? <Loader2 className="size-3 md:size-4 animate-spin" /> : (isFollowing ? <UserMinus className="size-3 md:size-4" /> : <UserPlus className="size-3 md:size-4" />)}
                    {isFollowing ? 'Unsubscribe' : 'Subscribe'}
                 </button>
                 <button className="h-12 md:h-14 px-2 md:px-12 rounded-xl md:rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-black text-[9px] md:text-[10px] tracking-widest uppercase hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center w-full md:w-auto">
                   Contact
                 </button>
              </div>
            </div>
          </div>
        </div>

        <div ref={productsAnchor} className="mt-16 mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 overflow-x-auto pb-4 w-full md:w-auto no-scrollbar">
             {['Signal Intake', 'Latest Drops', 'Catalogs'].map((tab) => (
               <button 
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`h-12 px-8 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all shrink-0 border-2 ${
                  tab === activeTab
                  ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)] shadow-lg' 
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                }`}
               >
                 {tab}
               </button>
             ))}
          </div>
        </div>

        {productsLoading ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-32 opacity-40">
             {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-[4/5] rounded-[32px] bg-[var(--bg-primary)] animate-pulse" />)}
           </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>

            {/* Pagination Controls */}
            {(totalPages > 1 || products.length === 20 || page > 1) && (
              <div className="flex items-center justify-center gap-3 pb-32">
                 <button 
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="px-6 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black tracking-widest uppercase disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
                 >
                   Previous
                 </button>
                 <div className="flex items-center gap-2">
                    {Array.from({ length: Math.max(totalPages, page + (products.length === 20 ? 1 : 0)) }, (_, i) => i + 1).map((p) => {
                       const maxPages = Math.max(totalPages, page + (products.length === 20 ? 1 : 0));
                       if (Math.abs(p - page) > 2 && p !== 1 && p !== maxPages) return p === 2 || p === maxPages - 1 ? <span key={p} className="opacity-30">...</span> : null;
                       return (
                          <button 
                             key={p}
                             onClick={() => handlePageChange(p)}
                             className={`size-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${page === p ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]'}`}
                          >
                             {p}
                          </button>
                       );
                    })}
                 </div>
                 <button 
                  disabled={products.length < 20}
                  onClick={() => handlePageChange(page + 1)}
                  className="px-6 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black tracking-widest uppercase disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
                 >
                   Next
                 </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[var(--bg-primary)]/40 rounded-[64px] p-24 text-center border border-[var(--glass-border)] mb-32 glass-panel">
            <Package className="size-16 mx-auto mb-6 opacity-10" />
            <h3 className="text-3xl font-black text-[var(--text-primary)] mb-2 uppercase tracking-tighter">Inventory Dry</h3>
            <p className="text-[var(--text-secondary)] max-w-md mx-auto font-medium opacity-60">This vendor node is currently preparing new assets for deployment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
