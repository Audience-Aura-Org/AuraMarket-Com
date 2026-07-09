"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, MapPin, Package, Users, Filter, LayoutGrid, List, ShieldCheck, Heart, UserPlus, UserMinus, Loader2, Check, Activity, Share2, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '@/components/ProductCard';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useChat } from '@/context/ChatContext';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';

const StatusCreator = dynamic(() => import('@/components/status/StatusCreator'), { ssr: false });

import { useAuthStore } from '@/hooks/useAuth';
import VendorFollowButton from '@/components/VendorFollowButton';
import { useLanguage } from '@/context/LanguageContext';

export default function StorePage({ storeId: explicitStoreId = null }) {
  const params = useParams();
  const router = useRouter();
  const id = explicitStoreId || params?.id;
  const { openChat } = useChat();
  const { t } = useLanguage();
  const productsAnchor = useRef(null);
  const { user, followedVendorIds, addFollowedVendor, removeFollowedVendor, isAuthenticated, fetchFollowedVendors } = useAuthStore();
  
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Products');
  const [showStatusCreator, setShowStatusCreator] = useState(false);

  const vendor = store?.vendor_id;
  const isFollowing = vendor ? followedVendorIds.includes(vendor._id?.toString() || id) : false;

  useEffect(() => {
    if (isAuthenticated) fetchFollowedVendors();
  }, [isAuthenticated, fetchFollowedVendors]);

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

        // 1. Fetch Store Details
        if (page === 1) {
          // nocache: bypass 3-day offline cache so store settings (minimum_order_amount, etc.) are always current
          const storeRes = await api.get(`/vendors/stores/${id}`, { params: { nocache: '1' } });
          if (storeRes.data.success) {
            setStore(storeRes.data.data.store);
          }
        }

        // 2. Fetch Store's Products
        let sortParam = '-createdAt';
        if (activeTab === 'Products') sortParam = '-createdAt';
        else if (activeTab === 'Top Rated') sortParam = '-rating';
        else if (activeTab === 'By Category') sortParam = 'category';

        const productsRes = await api.get(`/products`, { params: { vendor_id: id, page, limit: 20, sort: sortParam }});
        if (productsRes.data.success) {
          setProducts(productsRes.data.data.products);
          setTotalPages(productsRes.data.pagination?.pages || 1);
        }

      } catch (error) {
        console.error("Store Page Fetch Error:", error);
      } finally {
        setLoading(false);
        setProductsLoading(false);
      }
    };

    if (id) fetchStoreData();

    const refreshWhenOnline = () => {
      if (id) fetchStoreData();
    };
    window.addEventListener('online', refreshWhenOnline);
    return () => window.removeEventListener('online', refreshWhenOnline);
  }, [id, page, activeTab]);

  // Listen for global follow updates to sync local follower count
  useEffect(() => {
    const handleFollowSync = (e) => {
      const { vendorId: updatedId, isFollowing: currentlyFollowing } = e.detail;
      const targetId = vendor?._id?.toString() || id;
      
      if (updatedId === targetId) {
        setStore(prev => {
          if (!prev) return prev;
          const currentCount = prev.vendor_id?.follower_count || 0;
          const newCount = currentlyFollowing ? currentCount + 1 : Math.max(0, currentCount - 1);
          return {
            ...prev,
            vendor_id: { ...prev.vendor_id, follower_count: newCount }
          };
        });
      }
    };
    
    window.addEventListener('aura_follow_update', handleFollowSync);
    return () => window.removeEventListener('aura_follow_update', handleFollowSync);
  }, [vendor, id]);

  if (loading) return <LoadingSpinner fullScreen />;

  if (!store) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col items-center justify-center text-center px-6">
        <div className="size-24 bg-[var(--accent)]/10 text-[var(--accent)] rounded-[32px] flex items-center justify-center mb-6 border border-[var(--accent)]/20 shadow-xl">
          <span className="material-symbols-outlined text-4xl">store_off</span>
        </div>
        <h1 className="text-3xl  font-bold text-[var(--text-primary)] mb-2  tracking-tighter">{t('store.notFound', 'Store not found')}</h1>
        <p className="text-[var(--text-secondary)] max-w-md font-medium">{t('store.notFoundDetail', 'The store you are looking for might have moved or no longer exists in our registry.')}</p>
        <button onClick={() => window.history.back()} className="mt-8 px-8 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl  font-bold text-sm hover:opacity-90 transition-all">{t('common.goBack', 'Go Back')}</button>
      </div>
    );
  }

  const handleShare = async () => {
    const shareBase = window.location.hostname === 'localhost' ? 'https://auradime.com' : window.location.origin;
    const storeUrl = `${shareBase}/stores/${encodeURIComponent(vendor?._id?.toString() || id)}`;
    const storeName = store.vendor_id?.store_name || 'this store';
    try {
      if (navigator.share) {
        await navigator.share({ title: storeName, url: storeUrl });
      } else {
        await navigator.clipboard.writeText(storeUrl);
        toast.success('Store link copied!');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(storeUrl); toast.success('Store link copied!'); } catch {}
      }
    }
  };

  const TABS = [
    { id: 'Products',    label: t('store.tabs.products',   'All Products'), icon: <Package className="size-3.5" /> },
    { id: 'Top Rated',  label: t('store.tabs.topRated',   'Top Rated'),    icon: <Star    className="size-3.5" /> },
    { id: 'By Category',label: t('store.tabs.byCategory', 'By Category'),  icon: <LayoutGrid className="size-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative overflow-x-hidden">

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="relative h-52 sm:h-72 md:h-96 w-full overflow-hidden">
        <img
          src={store.banner || store.vendor_id?.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070'}
          className="w-full h-full object-cover brightness-[0.7]"
          alt="Store banner"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)]/20 to-transparent" />
      </div>

      {/* ── Identity Card ────────────────────────────────────────── */}
      <div className="relative z-10 -mt-8 px-4 sm:px-6 lg:px-12 pb-2">
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-2xl shadow-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">

            {/* Logo */}
            <div className="size-20 sm:size-24 rounded-2xl border-2 border-[var(--bg-primary)] overflow-hidden shadow-lg shrink-0 bg-[var(--bg-secondary)]">
              <img
                src={store.logo || store.vendor_id?.user_id?.branding?.logo || store.vendor_id?.user_id?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(store.vendor_id?.store_name || 'Store')}&background=random&size=200`}
                className="size-full object-cover"
                alt={store.vendor_id?.store_name}
              />
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                {store.vendor_id?.store_name}
              </h1>

              {/* Stat chips */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {Number(vendor?.rating || 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/15 text-[11px] font-semibold text-[var(--text-primary)]">
                    <Star className="size-3 text-[var(--accent)] fill-[var(--accent)]" />
                    {Number(vendor.rating).toFixed(1)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)]">
                  <Users className="size-3 text-[var(--accent)]" />
                  {vendor?.follower_count
                    ? vendor.follower_count >= 1000
                      ? `${(vendor.follower_count / 1000).toFixed(1)}k`
                      : vendor.follower_count
                    : '0'}{' '}
                  {t('store.followers', 'followers')}
                </span>
                {vendor?.verified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-[11px] font-semibold text-emerald-600">
                    <ShieldCheck className="size-3" />
                    {t('store.verified', 'Verified')}
                  </span>
                )}
                {Number(store?.minimum_order_amount) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-600">
                    <ShoppingBag className="size-3" />
                    Min. {Number(store.minimum_order_amount).toLocaleString()} XAF
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-row sm:flex-col items-stretch gap-2 w-full sm:w-auto shrink-0 sm:min-w-[130px]">
              <VendorFollowButton
                vendorId={vendor?._id?.toString() || id}
                className="!h-10 !text-[11px] flex-1 sm:flex-none"
              />
              {user?._id === store.vendor_id?.user_id?._id && (
                <button
                  onClick={() => setShowStatusCreator(true)}
                  className="h-10 px-4 rounded-xl bg-[var(--accent)] text-white font-semibold text-[11px] hover:brightness-110 transition-all shadow-md flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                >
                  <Activity className="size-3.5" />
                  {t('story.addStory', 'Add Story')}
                </button>
              )}
              <button
                onClick={() => openChat(store.vendor_id?.user_id?._id, null, {
                  store_name: store.vendor_id?.store_name,
                  branding: { logo: store.logo || store.vendor_id?.user_id?.branding?.logo }
                })}
                className="h-10 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-semibold text-[11px] hover:border-[var(--accent)]/40 transition-all flex-1 sm:flex-none"
              >
                {t('common.contact', 'Contact')}
              </button>
              <button
                onClick={handleShare}
                className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all flex items-center justify-center shrink-0"
                title="Share store"
              >
                <Share2 className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showStatusCreator && (
          <StatusCreator
            onClose={() => setShowStatusCreator(false)}
            onStatusCreated={() => {
              setShowStatusCreator(false);
              toast.success(t('story.synced', 'Story synchronized.'));
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Products Section ─────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-12 mt-8">

        {/* Minimum order notice */}
        {Number(store?.minimum_order_amount) > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
            <div className="size-8 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <ShoppingBag className="size-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[var(--text-primary)] tracking-tight">
                Minimum order — {Number(store.minimum_order_amount).toLocaleString()} XAF
              </p>
              <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">
                Your cart from this store must reach this amount to check out
              </p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div ref={productsAnchor} className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              whileTap={{ scale: 0.97 }}
              className={`h-10 px-5 rounded-full flex items-center gap-2 text-[11px] sm:text-[12px] font-semibold tracking-tight transition-all shrink-0 border ${
                tab.id === activeTab
                  ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)] shadow-md'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Grid */}
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 opacity-40">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-[var(--bg-primary)] animate-pulse" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onClick={(item) => router.push(`/products?id=${encodeURIComponent(item._id || item.id)}`)}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.max(totalPages, products.length === 20 ? page + 1 : page)}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-12 sm:p-20 text-center my-8">
            <Package className="size-12 mx-auto mb-4 opacity-10" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1 tracking-tight">
              {t('store.inventoryEmpty', 'No products yet')}
            </h3>
            <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto opacity-60">
              {t('store.inventoryEmptyDetail', 'This vendor is currently preparing new products.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
