"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
  Search, Star, LayoutGrid, Users,
  List, Check, ChevronRight, ChevronLeft, Folder, Home, MapPin, ShieldCheck, Store
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/common/Pagination';
import BlurUpImage from '@/components/common/BlurUpImage';
import { useFollow } from '@/hooks/useFollow';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';
import { trackSearch } from '@/services/tracking';
import VendorFollowButton from '@/components/VendorFollowButton';
import { useLanguage } from '@/context/LanguageContext';
import { TOP_NAV_HEIGHT, TOP_NAV_HEIGHT_LG } from '@/components/layout/TopNav';
import cartStore from '@/services/cartStore';

const PRICE_RANGES = [
  { id: 'under-5000', name: 'Under 5,000 XAF', min: 0, max: 5000 },
  { id: '5000-10000', name: '5,000 - 10,000 XAF', min: 5000, max: 10000 },
  { id: '10000-50000', name: '10,000 - 50,000 XAF', min: 10000, max: 50000 },
  { id: 'over-50000', name: 'Over 50,000 XAF', min: 50000, max: 9999999 },
];


function ShopContent() {
  const { t, label } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePrice, setActivePrice] = useState(null);
  const [search, setSearch] = useState(initialQuery);
  const [sortBy, setSortBy] = useState('-purchase_count');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const { openChat } = useChat();

  // --- Category drill-down state ---
  const [categoryTree, setCategoryTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); // array mapping of { _id, name, children }
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

  // --- Vendor Discovery state ---
  const [activeVendor, setActiveVendor] = useState(null);
  const [vendorLoading, setVendorLoading] = useState(false);

  // --- Cart state for live minimum order progress ---
  const [cartItems, setCartItems] = useState(cartStore.getItems());
  useEffect(() => {
    const unsub = cartStore.subscribe(({ items }) => setCartItems(items));
    return unsub;
  }, []);

  // --- Vendor Search state ---
  const [matchedVendors, setMatchedVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);

  // Current level of categories shown in navigation
  const currentLevel = breadcrumb.length === 0
    ? categoryTree
    : breadcrumb[breadcrumb.length - 1].children || [];

  // 1. Initial Category Load (Once on mount)
  useEffect(() => {
    const fetchCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const res = await api.get('/categories/with-products');
        if (res.data.success) setCategoryTree(res.data.data);
      } catch (err) { console.error('Category Load Error:', err); }
      finally { setIsCategoriesLoading(false); }
    };
    fetchCategories();
  }, []);

  // 2. Vendor Detail Load (Tracks vendorId changes)
  useEffect(() => {
    const fetchVendorData = async () => {
      const vid = searchParams.get('vendorId');
      if (!vid) { setActiveVendor(null); return; }
      
      setVendorLoading(true);
      try {
        const res = await api.get(`/vendors/stores/${vid}`);
        if (res.data.success) setActiveVendor(res.data.data.store);
      } catch (err) { console.error('Vendor Load Error:', err); }
      finally { setVendorLoading(false); }
    };
    fetchVendorData();
    
    // Sync active category name from URL independently
    const urlCategory = searchParams.get('category');
    const urlCategoryId = searchParams.get('categoryId');
    if (!urlCategory && !urlCategoryId) {
      setBreadcrumb([]);
      setActiveCategoryId(null);
      setActiveCategoryName('All');
      return;
    }

    setActiveCategoryId(urlCategoryId || null);
    setActiveCategoryName(urlCategory || 'All');
  }, [searchParams.get('vendorId'), searchParams.get('category'), searchParams.get('categoryId')]);

  // Debounce ref
  const fetchTimeout = useRef(null);
  const productCacheRef = useRef(new Map());
  // Tracks actual current page for event handlers that outlive renders (online refresh)
  const pageRef = useRef(1);
  // Generation counter — only the latest fetch may update state; stale responses are discarded.
  const fetchGenRef = useRef(0);

  // Optimized Fetcher
  const fetchProducts = useCallback(async (targetPage = 1, isImmediate = false) => {
    // Stamp this call — stale in-flight responses will be discarded.
    const gen = ++fetchGenRef.current;
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

    const executeFetch = async () => {
      const params = { page: targetPage, limit: 24 };
      if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
      if (activeCategoryId) params.categoryId = activeCategoryId;
      if (activePrice) {
        const range = PRICE_RANGES.find(p => p.id === activePrice);
        params.minPrice = range.min;
        params.maxPrice = range.max;
      }
      if (search) params.search = search;
      if (sortBy) params.sort = sortBy;

      const vendorId = searchParams.get('vendorId');
      if (vendorId) params.vendor_id = vendorId;

      const queryKey = JSON.stringify(params);
      const cached = productCacheRef.current.get(queryKey);

      // Serve from cache instantly for non-search queries (including category clicks)
      if (cached && !search) {
        if (gen !== fetchGenRef.current) return; // stale — newer fetch is in progress
        setProducts(cached.products);
        setTotalPages(cached.totalPages);
        setPage(targetPage); // confirm page matches fetched data
        return;
      }

      setLoading(true);

      // Fetch matching vendors if searching
      if (search) {
        setVendorsLoading(true);
        api.get('/vendors', { params: { search, limit: 8 } })
          .then(res => {
            if (res.data?.success) {
              setMatchedVendors(res.data.data.stores || []);
            } else {
              setMatchedVendors([]);
            }
          })
          .catch(err => {
            console.error('Vendor search error:', err);
            setMatchedVendors([]);
          })
          .finally(() => setVendorsLoading(false));
      } else {
        setMatchedVendors([]);
      }

      try {
        const res = await api.get('/products', { params });
        if (gen !== fetchGenRef.current) return; // stale — discard response
        if (res.data.success) {
          const nextProducts = res.data.data.products || [];
          setProducts(nextProducts);
          const total = res.data.pagination?.pages || 1;
          setTotalPages(total);
          setPage(targetPage); // confirm page matches what was actually fetched
          if (!search) {
            productCacheRef.current.set(queryKey, { products: nextProducts, totalPages: total });
          }
        }
      } catch (err) {
        console.error('Shop fetch error:', err);
      } finally {
        if (gen === fetchGenRef.current) setLoading(false);
      }
    };

    if (isImmediate) {
      executeFetch();
    } else {
      fetchTimeout.current = setTimeout(executeFetch, 300);
    }
  }, [activeCategoryId, activeCategoryName, activePrice, sortBy, search, searchParams]);
  // Note: 'page' intentionally excluded — always passed explicitly to avoid stale-closure issues.

  // Filter / sort change → reset to page 1 and fetch immediately.
  useEffect(() => {
    setPage(1);
    pageRef.current = 1;
    fetchProducts(1, true);
  }, [activeCategoryId, activeCategoryName, activePrice, sortBy]);
  // Note: 'fetchProducts' not in deps — it only recreates when filter state changes,
  // the same deps that trigger this effect, so the closure is always fresh.

  // Search change → debounce fetch (skip on initial mount where search === URL param).
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (search !== urlQuery) {
      setPage(1);
      pageRef.current = 1;
      fetchProducts(1, false); // debounced
    }
  }, [search]);

  // Online refresh — uses pageRef so the handler is never stale.
  useEffect(() => {
    const refreshWhenOnline = () => fetchProducts(pageRef.current, true);
    window.addEventListener('online', refreshWhenOnline);
    return () => window.removeEventListener('online', refreshWhenOnline);
  }, [fetchProducts]);

  const handleCategoryClick = (cat) => {
    setBreadcrumb(prev => [...prev, cat]);
    setActiveCategoryId(cat._id);
    setActiveCategoryName(cat.name);
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
      // Go to root
      setBreadcrumb([]);
      setActiveCategoryId(null);
      setActiveCategoryName('All');
    } else {
      const newBreadcrumb = breadcrumb.slice(0, idx + 1);
      setBreadcrumb(newBreadcrumb);
      const last = newBreadcrumb[newBreadcrumb.length - 1];
      setActiveCategoryId(last._id);
      setActiveCategoryName(last.name);
    }
  };

  const resultsAnchor = useRef(null);

  const handlePageChange = (p) => {
    setPage(p);
    pageRef.current = p;
    fetchProducts(p, true); // call directly — don't rely on an effect to pick up the new page
    resultsAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setIsSortOpen(false);
        setIsPriceOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const SORT_OPTIONS = [
    { value: '-purchase_count', label: t('sort.popularity', 'Most Popular') },
    { value: '-createdAt', label: t('sort.newest') },
    { value: 'price', label: t('sort.priceLowHigh') },
    { value: '-price', label: t('sort.priceHighLow') },
    { value: '-rating', label: t('sort.highestRated') }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 md:pt-0">
        <div className="flex flex-col w-full min-h-screen relative">

        {/* STICKY HEADER STACK: Search + Category bar */}
        <div
          className="sticky top-[var(--top-nav-height)] md:top-[var(--top-nav-height-lg)] z-40 bg-[var(--bg-primary)] shadow-sm"
          style={{
            '--top-nav-height': TOP_NAV_HEIGHT,
            '--top-nav-height-lg': TOP_NAV_HEIGHT_LG,
          }}
        >

          {/* Search Bar - Discovery SYNC */}
          <div className="px-6 lg:px-12 py-3 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]">
            <div className="relative max-w-2xl mx-auto">
              <input
                type="text"
                placeholder={t('search.productsPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProducts(1); } }}
                style={{ touchAction: 'manipulation' }}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-5 pr-12 text-[13px] placeholder:text-[11px] placeholder:font-normal outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5"
              />
              <button 
                onClick={() => { setPage(1); fetchProducts(1); }}
                className="absolute right-1 top-1 h-[calc(100%-8px)] px-5 bg-[var(--accent)] text-white rounded-full shadow-lg hover:opacity-90 transition-all flex items-center justify-center  font-bold"
              >
                <Search className="size-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
            <div className="max-w-7xl px-6 lg:px-12 py-3 flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar w-full">
               {isCategoriesLoading && currentLevel.length === 0 ? null : (
                <>
                 {breadcrumb.length > 0 ? (
                   <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[11px] lg:text-[12px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                     <Home className="size-3.5" /> {t('common.market')}
                   </button>
                 ) : (
                    <button 
                      onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }}
                      className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] lg:text-[12px] md:text-sm font-normal tracking-tight shadow-sm ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {t('common.all')}
                    </button>
                 )}

                 {breadcrumb.length > 0 && breadcrumb.map((crumb, idx) => (
                   <div key={crumb._id} className="flex items-center gap-2 shrink-0">
                      <ChevronRight className="size-3 text-[var(--glass-border)]" />
                       <button 
                        onClick={() => handleBreadcrumbClick(idx)} 
                        className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] lg:text-[12px] md:text-sm font-normal tracking-tight shadow-sm ${idx === breadcrumb.length - 1 && currentLevel.length === 0 ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                      >
                        {label(crumb.name)}
                      </button>
                   </div>
                 ))}

                 {breadcrumb.length > 0 && currentLevel.length > 0 && <div className="h-4 w-px bg-[var(--glass-border)] mx-1 shrink-0" />}

                 {currentLevel.map(cat => (
                   <button
                       key={cat._id}
                       onClick={() => {
                         if (cat.children && cat.children.length > 0) handleCategoryClick(cat);
                         else { setActiveCategoryId(cat._id); setActiveCategoryName(cat.name); }
                       }}
                       className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] lg:text-[12px] md:text-sm font-normal tracking-tight shadow-sm ${activeCategoryId === cat._id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}`}
                    >
                      {label(cat.name)}
                    </button>
                 ))}
                </>
               )}
            </div>
          </div>
        </div>
        
        {/* Vendor Discovery Header (Elite Store Profile Style) */}
        {activeVendor && (
          <div className="relative w-full">
            {/* 1. Banner Section - COMPACT */}
            <div className="relative h-[265px] md:h-[420px] w-full overflow-hidden">
              <BlurUpImage 
                src={activeVendor.banner || activeVendor.vendor_id?.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070'} 
                className="w-full h-full" 
                imgClassName="brightness-75 transition-transform duration-[3s] hover:scale-105" 
                alt="Store Banner"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-black/20" />
            </div>

            {/* 2. Identity & Stats Overlay - CENTRALIZED WRAPPER ONLY */}
            <div className="max-w-7xl mx-auto px-4 md:px-12 relative z-10 -mt-10 md:-mt-14 pb-4">
              <div className="glass-panel rounded-3xl md:rounded-[3rem] p-4 md:p-6 border border-[var(--glass-border)] shadow-2xl bg-[var(--bg-primary)]/80 backdrop-blur-3xl overflow-hidden">
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-center text-center md:text-left">
                  {/* Overlapping Logo - ULTRA COMPACT */}
                  <div className="size-16 md:size-24 rounded-2xl md:rounded-[2rem] border-2 md:border-4 border-[var(--bg-primary)] overflow-hidden shadow-lg shrink-0 bg-[var(--bg-secondary)] relative group">
                    <BlurUpImage 
                      src={activeVendor.logo || activeVendor.vendor_id?.user_id?.branding?.logo || activeVendor.vendor_id?.user_id?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeVendor.vendor_id?.store_name || 'Store')}&background=random&size=200`} 
                      className="size-full" 
                      imgClassName="transition-transform duration-700 group-hover:scale-110" 
                      alt={activeVendor.vendor_id?.store_name} 
                    />
                  </div>

                  <div className="flex-1 min-w-0 w-full space-y-3">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <h1 className="text-xl md:text-3xl  font-bold tracking-tighter text-[var(--text-primary)] ">
                        {activeVendor.vendor_id?.store_name}
                      </h1>
                      {activeVendor.vendor_id?.verified && (
                        <div className="size-5 md:size-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-sm">
                          <Check className="size-3 md:size-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 shadow-sm group hover:bg-[var(--accent)]/10 transition-all">
                        <Star className="size-3.5 text-[var(--accent)] fill-[var(--accent)]/20 group-hover:scale-110 transition-transform" />
                        {Number(activeVendor.vendor_id?.rating || 0) > 0 && (
                          <span className="text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)]">
                            {Number(activeVendor.vendor_id.rating).toFixed(1)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm group hover:border-[var(--accent)]/30 transition-all">
                        <Users className="size-3.5 text-[var(--accent)] group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">
                          {activeVendor.vendor_id?.follower_count ? (activeVendor.vendor_id.follower_count >= 1000 ? (activeVendor.vendor_id.follower_count / 1000).toFixed(1) + 'k' : activeVendor.vendor_id.follower_count) : '0'}
                        </span>
                        <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)]  opacity-40">{t('common.network')}</span>
                      </div>

                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                        <span className="text-[11px] lg:text-[12px]  font-semibold text-emerald-600 tracking-tight">{t('common.verifiedVendor')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center gap-2 w-full md:w-auto shrink-0">
                    <VendorFollowButton vendorId={activeVendor.vendor_id?._id} />
                    <button 
                      onClick={() => openChat(activeVendor.vendor_id?.user_id?._id, null, {
                        store_name: activeVendor.vendor_id?.store_name,
                        branding: { logo: activeVendor.logo || activeVendor.vendor_id?.user_id?.branding?.logo }
                      })}
                      className="h-10 md:h-11 px-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-semibold text-[10px] lg:text-[12px] tracking-tight  hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30 transition-all shadow-sm flex-1 md:flex-none"
                    >
                      {t('common.contact')}
                    </button>
                  </div>
                </div>

                {/* Live minimum order progress bar */}
                {(() => {
                  const minimum = Number(activeVendor.minimum_order_amount) || 0;
                  if (minimum <= 0) return null;
                  const vendorId = activeVendor.vendor_id?._id?.toString() || String(activeVendor.vendor_id || '');
                  const subtotal = cartItems
                    .filter(i => String(i.vendor_id) === vendorId)
                    .reduce((s, i) => s + i.price * i.quantity, 0);
                  const pct = Math.min(100, Math.round((subtotal / minimum) * 100));
                  const met = subtotal >= minimum;
                  return (
                    <div className={`mt-3 rounded-2xl border px-3 py-2.5 transition-colors duration-300 ${met ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold tracking-tight flex items-center gap-1 ${met ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {met ? null : <AlertTriangle className="size-3 shrink-0" />}
                          {met ? 'Minimum order met' : `Add ${(minimum - subtotal).toLocaleString()} XAF to meet min. order`}
                        </span>
                        <span className={`text-[10px] font-semibold font-mono ${met ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {subtotal.toLocaleString()} / {minimum.toLocaleString()} XAF
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main ref={resultsAnchor} className="flex-1 bg-[var(--bg-secondary)] min-h-screen transition-colors duration-500 overflow-hidden pt-[1px]">
          
          {/* Results Info & Action Bar */}
          <div className="px-3 md:px-6 lg:px-12 py-1.5 md:py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-2 md:gap-3 bg-[var(--bg-secondary)]">
            
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <h3 className="text-xs md:text-xl font-bold text-[var(--text-primary)] tracking-tight truncate">
                {activeCategoryName === 'All' ? t('common.globalMarket') : label(activeCategoryName)}
              </h3>
              <Link
                href="/discovery?tab=vendors"
                className="shrink-0 hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
              >
                <Store className="size-3" /> Vendors
              </Link>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto z-20">
              
              {/* PRICE FILTERS */}
              <div className="relative dropdown-container">
                <button 
                  onClick={() => { setIsPriceOpen(!isPriceOpen); setIsSortOpen(false); }}
                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tight shadow-sm"
                >
                  {t('common.price')}
                  <ChevronRight className={`size-2.5 md:size-3 text-[var(--text-secondary)] transition-transform ${isPriceOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isPriceOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                     <button onClick={() => {setActivePrice(null); setIsPriceOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${!activePrice ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                       {t('common.anyPrice')} {!activePrice && <Check className="size-3.5" />}
                     </button>
                     {PRICE_RANGES.map(range => (
                       <button key={range.id} onClick={() => {setActivePrice(range.id); setIsPriceOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${activePrice === range.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                         {t(`price.${range.id.replace(/-/g, '').replace('under5000', 'under5000').replace('500010000', '5000to10000').replace('1000050000', '10000to50000').replace('over50000', 'over50000')}`, range.name)} {activePrice === range.id && <Check className="size-3.5" />}
                       </button>
                     ))}
                  </div>
                )}
              </div>

              {/* SORT DROPDOWN */}
              <div className="relative dropdown-container">
                <button 
                  onClick={() => { setIsSortOpen(!isSortOpen); setIsPriceOpen(false); }}
                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px]  font-semibold tracking-tight shadow-sm"
                >
                  {t('common.sort')}
                  <ChevronRight className={`size-2.5 md:size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                </button>
                
                {isSortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                     {SORT_OPTIONS.map(opt => (
                       <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                         {opt.label}
                         {sortBy === opt.value && <Check className="size-3.5" />}
                       </button>
                     ))}
                  </div>
                )}
              </div>
              
              {/* VIEW MODE */}
              <div className="flex bg-[var(--bg-primary)] rounded-lg md:rounded-2xl p-0.5 md:p-1 border border-[var(--glass-border)]">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 md:p-2.5 rounded-md md:rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}>
                  <LayoutGrid className="size-3 md:size-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 md:p-2.5 rounded-md md:rounded-xl transition-all ${viewMode === 'list' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}>
                  <List className="size-3 md:size-4" />
                </button>
              </div>
            </div>
            
          </div>

          {/* Product Grid - Consistently tight layout - ZOOMED STYLE */}
          <div className="px-4 md:px-8 lg:px-12 py-6">
            
            {/* MATCHED STORES STRIP */}
            {search && (matchedVendors.length > 0 || vendorsLoading) && (
              <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      {t('search.matchingStores', 'Matching Stores')}
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)]/50 tracking-tight">
                    {vendorsLoading ? 'Searching...' : `${matchedVendors.length} found`}
                  </span>
                </div>
                
                {vendorsLoading && matchedVendors.length === 0 ? (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="w-64 h-24 shrink-0 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 w-full">
                    {matchedVendors.map((vendor) => {
                      const logo = vendor.store?.logo || vendor.user_id?.branding?.logo || vendor.user_id?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.store_name || 'Store')}&background=random&size=200`;
                      const banner = vendor.store?.banner || vendor.user_id?.branding?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070';
                      return (
                        <button
                          type="button"
                          key={vendor._id}
                          onClick={() => router.push(`/stores?id=${encodeURIComponent(vendor._id)}`)}
                          className="w-64 shrink-0 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 hover:border-[var(--accent)]/40 transition-all cursor-pointer overflow-hidden group shadow-sm flex flex-col relative text-left"
                        >
                          {/* Banner background thumbnail */}
                          <div className="h-12 w-full overflow-hidden relative">
                            <img src={banner} alt="" className="w-full h-full object-cover brightness-[0.6] transition-transform duration-700 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          </div>
                          
                          {/* Logo overlapping banner */}
                          <div className="absolute top-6 left-4 size-10 rounded-xl border border-white/10 overflow-hidden shadow-md bg-[var(--bg-primary)]">
                            <img src={logo} alt="" className="size-full object-cover" />
                          </div>
                          
                          {/* Store Details */}
                          <div className="pt-5 pb-3 px-4 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1">
                                <h4 className="font-bold text-[13px] text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors leading-tight">
                                  {vendor.store_name}
                                </h4>
                                {vendor.verified && (
                                  <svg className="size-3 text-[var(--accent)] shrink-0 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                )}
                              </div>
                              <p className="text-[10px] font-semibold text-[var(--text-secondary)] truncate mt-0.5 leading-snug">
                                {vendor.description || 'No store description'}
                              </p>
                            </div>
                            
                            {/* Stats */}
                            <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-[var(--text-secondary)]/60 tracking-wider">
                              <span className="flex items-center gap-0.5">
                                <svg className="size-3 text-amber-400 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                {Number(vendor.rating || 0) > 0 ? Number(vendor.rating).toFixed(1) : 'New'}
                              </span>
                              <span>
                                {vendor.follower_count || 0} followers
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Horizontal divider */}
                <div className="h-px w-full bg-[var(--glass-border)] mt-6" />
              </div>
            )}

            {products.length === 0 && loading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-[3/4] rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50"
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 md:py-40 text-center">
                <div className="size-20 md:size-24 bg-[var(--accent)]/5 rounded-full flex items-center justify-center mx-auto mb-8 text-[var(--text-secondary)]/50">
                  <Search className="size-8 md:size-10" />
                </div>
                <h2 className="text-2xl md:text-3xl  font-bold text-[var(--text-primary)] mb-2">{t('common.noProductsFound')}</h2>
                <p className="text-[var(--text-secondary)] font-medium text-sm md:text-base px-6">
                  {t('common.noMatches')}
                </p>
                <button
                  onClick={() => {
                    setActiveCategoryId(null);
                    setActiveCategoryName('All');
                    setBreadcrumb([]);
                    setActivePrice(null);
                    setSearch('');
                  }}
                  className="mt-10 px-8 py-3 bg-[var(--accent)] text-white  font-semibold text-[10px] lg:text-[12px] tracking-[0.2em] rounded-full shadow-lg shadow-[var(--accent)]/20 "
                >
                  {t('common.resetFilters')}
                </button>
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6 gap-3 md:gap-4 mb-12" : "flex flex-col gap-4 mb-12 mx-auto max-w-4xl"}>
                  {products.map(product => (
                    <ProductCard key={product._id} product={product} layout={viewMode} />
                  ))}
                </div>

                {/* --- Pagination --- */}
                <div className="mt-8">
                  <Pagination 
                    currentPage={page} 
                    totalPages={totalPages} 
                    onPageChange={handlePageChange} 
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}



export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}

