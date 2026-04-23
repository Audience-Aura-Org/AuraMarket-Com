"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { 
  Search, Star, LayoutGrid, Users,
  List, Check, ChevronRight, ChevronLeft, Folder, Home, MapPin
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BlurUpImage from '@/components/common/BlurUpImage';
import { useFollow } from '@/hooks/useFollow';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';
import { trackSearch } from '@/services/tracking';

const PRICE_RANGES = [
  { id: 'under-5000', name: 'Under 5,000 XAF', min: 0, max: 5000 },
  { id: '5000-10000', name: '5,000 - 10,000 XAF', min: 5000, max: 10000 },
  { id: '10000-50000', name: '10,000 - 50,000 XAF', min: 10000, max: 50000 },
  { id: 'over-50000', name: 'Over 50,000 XAF', min: 50000, max: 9999999 },
];


function ShopContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePrice, setActivePrice] = useState(null);
  const [search, setSearch] = useState(initialQuery);
  const [sortBy, setSortBy] = useState('-createdAt');
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

  // Current level of categories shown in navigation
  const currentLevel = breadcrumb.length === 0
    ? categoryTree
    : breadcrumb[breadcrumb.length - 1].children;

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
    if (urlCategory) setActiveCategoryName(urlCategory);
  }, [searchParams.get('vendorId'), searchParams.get('category')]);

  // Debounce ref
  const fetchTimeout = useRef(null);
  const productCacheRef = useRef(new Map());

  // Optimized Fetcher
  const fetchProducts = useCallback(async (targetPage = page, isImmediate = false) => {
    setLoading(true);

    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

    const executeFetch = async () => {
      const params = { page: targetPage, limit: 24 };
      if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
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
      
      // Only use cache for non-search queries to avoid stale results
      if (cached && !search) {
        setProducts(cached.products);
        setTotalPages(cached.totalPages);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/products', { params });
        if (res.data.success) {
          const nextProducts = res.data.data.products || [];
          setProducts(nextProducts);
          const total = res.data.pagination?.pages || 1;
          setTotalPages(total);
          
          if (!search) {
            productCacheRef.current.set(queryKey, { products: nextProducts, totalPages: total });
          }
        }
      } catch (err) {
        console.error('Shop fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isImmediate) {
      executeFetch();
    } else {
      fetchTimeout.current = setTimeout(executeFetch, 300);
    }
  }, [activeCategoryName, activePrice, sortBy, search, page, searchParams]); 

  // Trigger fetch: Use immediate for filters, debounce for search
  useEffect(() => {
    // Determine if we should bypass the debounce (for explicit filter changes)
    const urlQuery = searchParams.get('q') || '';
    const isSearching = search !== urlQuery;
    fetchProducts(page, !isSearching);
  }, [page, activeCategoryName, activePrice, sortBy]);

  // Special handle for search input to ensure it debounces correctly
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (search !== urlQuery) {
      fetchProducts(1, false); // debounced
    }
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategoryName, activePrice, sortBy, search]);

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
    { value: '-createdAt', label: 'Newest Arrivals' },
    { value: 'price', label: 'Price: Low to High' },
    { value: '-price', label: 'Price: High to Low' },
    { value: '-rating', label: 'Highest Rated' }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30">
        <div className="flex flex-col w-full min-h-screen relative">

        {/* STICKY HEADER STACK: Search + Category bar */}
        <div className="sticky top-[57px] md:top-[64px] z-40 bg-[var(--bg-primary)] shadow-sm">

          {/* Search Bar - DISCOVERY SYNC */}
          <div className="px-6 lg:px-12 py-3 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]">
            <div className="relative max-w-2xl mx-auto">
              <input
                type="text"
                placeholder="Search premium products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProducts(1); } }}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-5 pr-12 text-[10px] md:text-sm outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5"
              />
              <button 
                onClick={() => { setPage(1); fetchProducts(1); }}
                className="absolute right-1 top-1 h-[calc(100%-8px)] px-5 bg-[var(--accent)] text-white rounded-full shadow-lg hover:opacity-90 transition-all flex items-center justify-center font-bold"
              >
                <Search className="size-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
            <div className="max-w-7xl px-6 lg:px-12 py-3 flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar w-full">
               {isCategoriesLoading ? (
                 [...Array(6)].map((_, i) => (
                   <div key={i} className="shrink-0 w-24 h-9 rounded-full bg-[var(--bg-secondary)] animate-pulse border border-[var(--glass-border)]/30"></div>
                 ))
               ) : (
                <>
                 {breadcrumb.length > 0 ? (
                   <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[11px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                     <Home className="size-3.5" /> Market
                   </button>
                 ) : (
                    <button 
                      onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }}
                      className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] md:text-sm font-normal tracking-tight shadow-sm ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                    >
                      All
                    </button>
                 )}

                 {breadcrumb.length > 0 && breadcrumb.map((crumb, idx) => (
                   <div key={crumb._id} className="flex items-center gap-2 shrink-0">
                      <ChevronRight className="size-3 text-[var(--glass-border)]" />
                       <button 
                        onClick={() => handleBreadcrumbClick(idx)} 
                        className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] md:text-sm font-normal tracking-tight shadow-sm ${idx === breadcrumb.length - 1 && currentLevel.length === 0 ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                      >
                        {crumb.name}
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
                       className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] md:text-sm font-normal tracking-tight shadow-sm ${activeCategoryId === cat._id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}`}
                    >
                      {cat.name}
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
                      <h1 className="text-xl md:text-3xl font-black tracking-tighter text-[var(--text-primary)] uppercase">
                        {activeVendor.vendor_id?.store_name}
                      </h1>
                      {activeVendor.vendor_id?.verified && (
                        <div className="size-5 md:size-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-sm">
                          <Check className="size-3 md:size-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-[9px] md:text-[10px] font-black tracking-wider text-[var(--text-secondary)] uppercase">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--accent)]/5 text-[var(--accent)]">Online Store</span>
                      <span className="opacity-40">•</span>
                      <span>{products.length} Items</span>
                      <span className="opacity-40">•</span>
                      <div className="flex items-center gap-1 text-[var(--accent)]">
                        <Star className="size-2.5 fill-current" />
                        {activeVendor.vendor_id?.rating?.toFixed(1) || '4.9'}
                      </div>
                      <span className="opacity-40 hidden md:block">•</span>
                      <p className="hidden md:block normal-case font-medium opacity-60 truncate max-w-md">
                        {activeVendor.vendor_id?.description || 'Premium Aura network provider.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
                       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/5 border border-[var(--glass-border)]">
                          <LayoutGrid className="size-3 text-[var(--accent)]" />
                          <span className="text-[10px] font-black text-[var(--text-primary)]">{products.length}</span>
                          <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase opacity-40">Objects</span>
                       </div>
                       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/5 border border-[var(--glass-border)]">
                          <Users className="size-3 text-[var(--accent)]" />
                          <span className="text-[10px] font-black text-[var(--text-primary)]">{activeVendor.vendor_id?.follower_count || 0}</span>
                          <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase opacity-40">Followers</span>
                       </div>
                       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Trusted</span>
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
                      className="h-10 md:h-11 px-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-primary)] font-black text-[9px] tracking-widest uppercase hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30 transition-all shadow-sm flex-1 md:flex-none"
                    >
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main ref={resultsAnchor} className="flex-1 bg-[var(--bg-secondary)] min-h-screen transition-colors duration-500 overflow-hidden pt-[1px]">
          
          {/* Results Info & Action Bar */}
          <div className="px-3 md:px-6 lg:px-12 py-1.5 md:py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-2 md:gap-3 bg-[var(--bg-secondary)]">
            
            <div className="flex items-center gap-1.5 md:gap-3">
              <h3 className="text-xs md:text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {activeCategoryName === 'All' ? 'Global Market' : activeCategoryName}
              </h3>
              <div className="h-3 md:h-4 w-px bg-[var(--glass-border)]" />
              <p className="text-[10px] md:text-[11px] font-medium text-[var(--text-secondary)] tracking-tight opacity-60">
                {products.length} Results
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto z-20">
              
              {/* PRICE FILTERS */}
              <div className="relative dropdown-container">
                <button 
                  onClick={() => { setIsPriceOpen(!isPriceOpen); setIsSortOpen(false); }}
                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] md:text-[11px] font-bold tracking-tight shadow-sm"
                >
                  Price
                  <ChevronRight className={`size-2.5 md:size-3 text-[var(--text-secondary)] transition-transform ${isPriceOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isPriceOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                     <button onClick={() => {setActivePrice(null); setIsPriceOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${!activePrice ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                       Any Price {!activePrice && <Check className="size-3.5" />}
                     </button>
                     {PRICE_RANGES.map(range => (
                       <button key={range.id} onClick={() => {setActivePrice(range.id); setIsPriceOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${activePrice === range.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                         {range.name} {activePrice === range.id && <Check className="size-3.5" />}
                       </button>
                     ))}
                  </div>
                )}
              </div>

              {/* SORT DROPDOWN */}
              <div className="relative dropdown-container">
                <button 
                  onClick={() => { setIsSortOpen(!isSortOpen); setIsPriceOpen(false); }}
                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] md:text-[11px] font-bold tracking-tight shadow-sm"
                >
                  Sort
                  <ChevronRight className={`size-2.5 md:size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                </button>
                
                {isSortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                     {SORT_OPTIONS.map(opt => (
                       <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
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
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6 gap-4 md:gap-5">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 md:py-40 text-center">
                <div className="size-20 md:size-24 bg-[var(--accent)]/5 rounded-full flex items-center justify-center mx-auto mb-8 text-[var(--text-secondary)]/50">
                  <Search className="size-8 md:size-10" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-2">No Products Found</h2>
                <p className="text-[var(--text-secondary)] font-medium text-sm md:text-base px-6">No matches found for your current search or filters.</p>
                <button
                  onClick={() => {
                    setActiveCategoryId(null);
                    setActiveCategoryName('All');
                    setBreadcrumb([]);
                    setActivePrice(null);
                    setSearch('');
                  }}
                  className="mt-10 px-8 py-3 bg-[var(--accent)] text-white font-black text-[10px] tracking-[0.2em] rounded-full shadow-lg shadow-[var(--accent)]/20 uppercase"
                >
                  Reset Filters
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

// Sub-component for Follow Button to use the hook correctly
function VendorFollowButton({ vendorId }) {
  const { isFollowing, toggleFollow, loading } = useFollow(vendorId);
  if (!vendorId) return null;

  return (
    <button 
      onClick={toggleFollow}
      disabled={loading}
      className={`px-6 h-10 md:h-11 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-none ${
        isFollowing 
        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20' 
        : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 shadow-lg shadow-[var(--accent)]/10'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <ShopContent />
    </Suspense>
  );
}
