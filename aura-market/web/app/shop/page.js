"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { 
  Search, Star, LayoutGrid, 
  List, Check, ChevronRight, ChevronLeft, Folder, Home, MapPin
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import api from '@/services/api';
import { trackSearch } from '@/services/tracking';

export const dynamic = 'force-dynamic';

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

  // --- Category drill-down state ---
  const [categoryTree, setCategoryTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); // array of { _id, name, children }
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');

  // Current level of categories shown in sidebar
  const currentLevel = breadcrumb.length === 0
    ? categoryTree
    : breadcrumb[breadcrumb.length - 1].children;

  // Fetch categories that have products
  useEffect(() => {
    api.get('/categories/with-products')
      .then(res => { if (res.data.success) setCategoryTree(res.data.data); })
      .catch(err => console.error(err));
  }, []);

  // Sync category from URL
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (urlCategory) {
      setActiveCategoryName(urlCategory);
    }
  }, [searchParams]);

  // Debounce ref to avoid multiple overlapping fetches
  const fetchTimeout = useRef(null);
  const productCacheRef = useRef(new Map());

  // Memoize the fetcher to stabilize the dependency graph
  const fetchProducts = useCallback(async (targetPage = page) => {
    // Clear any existing pending fetch to avoid overwhelming the server
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

    fetchTimeout.current = setTimeout(async () => {
      const params = { page: targetPage, limit: 20 }; // Limited to 20 per page as requested
      if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
      if (activePrice) {
        const range = PRICE_RANGES.find(p => p.id === activePrice);
        params.minPrice = range.min;
        params.maxPrice = range.max;
      }
      if (search) params.search = search;
      if (sortBy) params.sort = sortBy;

      const queryKey = JSON.stringify(params);
      const cached = productCacheRef.current.get(queryKey);
      if (cached) {
        setProducts(cached.products);
        setTotalPages(cached.totalPages);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get('/products', { params });
        if (res.data.success) {
          const nextProducts = res.data.data.products || [];
          setProducts(nextProducts);
          const total = res.data.pagination?.pages || 1;
          setTotalPages(total);
          productCacheRef.current.set(queryKey, { products: nextProducts, totalPages: total });
        }
      } catch (err) {
        console.error('Shop fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce buffer
  }, [activeCategoryName, activePrice, sortBy, search, page]); 

  useEffect(() => {
    fetchProducts(page);
  }, [page, activeCategoryName, activePrice, sortBy]);

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

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30">
      {/* Search Header */}
      <div className="bg-[var(--bg-primary)] border-b border-[var(--glass-border)] py-3 px-4 md:px-6 lg:px-20 sticky top-[64px] md:top-[72px] z-40 transition-all">
        
        {/* Mobile Layout */}
        <div className="md:hidden flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-[var(--accent)]">
              <MapPin className="size-3" /> AURA HUB
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-[var(--text-primary)] tracking-widest">ORDERS</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input 
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    trackSearch(search);
                    setPage(1);
                    fetchProducts(1);
                  }
                }}
                placeholder="Search products..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2.5 pl-3.5 pr-12 text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-bold"
              />
              <button onClick={() => { setPage(1); fetchProducts(1); }} className="absolute right-1 top-1 h-[calc(100%-8px)] px-3 text-[var(--accent)] bg-[var(--accent)]/10 rounded-lg">
                <Search className="size-4" />
              </button>
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="size-11 flex-shrink-0 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            </button>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex flex-wrap items-center gap-4 lg:gap-8">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-[var(--accent)] whitespace-nowrap">
            <MapPin className="size-3" /> DELIVER TO AURA HUB
          </div>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  trackSearch(search);
                  setPage(1);
                  fetchProducts(1);
                }
              }}
              placeholder="Search for products..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg py-2.5 pl-3.5 pr-14 text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-semibold"
            />
            <button onClick={() => { setPage(1); fetchProducts(1); }} className="absolute right-1 top-1 h-[calc(100%-8px)] px-4 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent)]/80 transition-all">
              <Search className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-6 ml-auto">
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg text-[10px] font-black tracking-widest uppercase hover:text-[var(--accent)] transition-all"
            >
              Filters
            </button>
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-[var(--text-secondary)] tracking-widest leading-none">MY</span>
              <span className="text-[10px] font-black text-[var(--text-primary)]">ORDERS</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full min-h-[calc(100vh-140px)]">
        {/* Mobile Overlay Background */}
        {isFilterOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[50]" 
            onClick={() => setIsFilterOpen(false)}
          />
        )}

        {/* ── SIDEBAR (Desktop & Mobile Drawer) ── */}
        <aside className={`
          fixed inset-y-0 left-0 z-[60] lg:relative lg:inset-auto lg:z-10
          w-[280px] flex-shrink-0 bg-[var(--bg-primary)] flex-col py-6 px-0 lg:sticky top-[125px] h-full lg:h-[calc(100vh-125px)] overflow-hidden transition-transform duration-300 lg:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.1)] lg:shadow-none
          ${isFilterOpen ? 'translate-x-0 flex' : '-translate-x-full lg:flex'}
          lg:border-r lg:border-[var(--glass-border)]
        `}>
          <div className="lg:hidden flex items-center justify-between px-6 mb-6">
             <h2 className="text-xl font-black text-[var(--accent)]">FILTERS</h2>
             <button onClick={() => setIsFilterOpen(false)} className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                <ChevronLeft className="size-6" />
             </button>
          </div>
          
          {/* Breadcrumb nav */}
          <div className="px-6 mb-4">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className="flex items-center gap-1 text-[10px] font-black tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors uppercase"
              >
                <Home className="size-3" /> Categories
              </button>
              {breadcrumb.map((crumb, idx) => (
                <span key={crumb._id} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-[var(--glass-border)]" />
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    className={`text-[10px] font-black tracking-widest uppercase transition-colors ${
                      idx === breadcrumb.length - 1
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Back button */}
          {breadcrumb.length > 0 && (
            <button
              onClick={() => handleBreadcrumbClick(breadcrumb.length - 2)}
              className="mx-6 mb-3 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              <ChevronLeft className="size-3.5" /> Back
            </button>
          )}

          {/* Category heading */}
          <h3 className="px-6 text-xs font-black tracking-[0.2em] text-[var(--text-primary)] mb-3 uppercase">
            {breadcrumb.length === 0 ? 'All Categories' : breadcrumb[breadcrumb.length - 1].name}
          </h3>

          {/* Category list — scrollable */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* "All" option at current level */}
            <button
              onClick={() => {
                if (breadcrumb.length === 0) {
                  setActiveCategoryId(null);
                  setActiveCategoryName('All');
                } else {
                  const parent = breadcrumb[breadcrumb.length - 1];
                  setActiveCategoryId(parent._id);
                  setActiveCategoryName(parent.name);
                }
              }}
              className={`w-full text-left px-6 py-2.5 text-[11px] font-bold transition-colors border-l-2 ${
                activeCategoryId === (breadcrumb.length === 0 ? null : breadcrumb[breadcrumb.length - 1]._id)
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50'
              }`}
            >
              All {breadcrumb.length === 0 ? 'Categories' : breadcrumb[breadcrumb.length - 1].name}
            </button>

            {currentLevel.map(cat => (
              <button
                key={cat._id}
                onClick={() => {
                  if (cat.children && cat.children.length > 0) {
                    handleCategoryClick(cat);
                  } else {
                    setActiveCategoryId(cat._id);
                    setActiveCategoryName(cat.name);
                    if (window.innerWidth < 1024) setIsFilterOpen(false);
                  }
                }}
                className={`w-full text-left px-6 py-2.5 text-[11px] font-bold transition-colors border-l-2 flex items-center justify-between group ${
                  activeCategoryId === cat._id
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/50'
                }`}
              >
                <span>{cat.name}</span>
                {cat.children && cat.children.length > 0 && (
                  <ChevronRight className="size-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}

            {currentLevel.length === 0 && (
              <p className="px-6 py-4 text-[10px] text-[var(--text-secondary)] opacity-50 font-bold uppercase tracking-widest">
                No subcategories
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--glass-border)] my-4" />

          {/* Price Filter */}
          <div className="px-6 space-y-4 pb-20 lg:pb-4">
            <h3 className="text-xs font-black tracking-[0.2em] text-[var(--text-primary)] uppercase">Price Range</h3>
            {PRICE_RANGES.map(range => (
              <button
                key={range.id}
                onClick={() => {
                   setActivePrice(activePrice === range.id ? null : range.id);
                   if (window.innerWidth < 1024) setIsFilterOpen(false);
                }}
                className={`flex items-center gap-3 text-[11px] font-bold tracking-tight text-left w-full group transition-colors ${activePrice === range.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
              >
                <div className={`size-4 rounded border transition-all flex items-center justify-center flex-shrink-0 ${activePrice === range.id ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--glass-border)] group-hover:border-[var(--accent)]/50'}`}>
                  {activePrice === range.id && <Check className="size-2.5 text-white" />}
                </div>
                {range.name}
              </button>
            ))}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main ref={resultsAnchor} className="flex-1 bg-[var(--bg-secondary)] min-h-screen transition-colors duration-500 overflow-hidden pt-[1px]">
          {/* Results Info + Sort */}
          <div className="px-4 md:px-6 lg:px-12 py-3 md:py-4 border-b border-[var(--glass-border)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[var(--bg-primary)]/80 backdrop-blur-xl z-30 font-[var(--font-poppins)]">
            <div className="flex flex-col text-left w-full md:w-auto">
              <p className="text-[11px] md:text-xs font-medium text-[var(--text-secondary)] tracking-tight">
                Showing <span className="text-[var(--text-primary)] font-semibold">{products.length}</span> results
                {activeCategoryName !== 'All' && (
                  <> in <span className="text-[var(--text-primary)] font-semibold"> {activeCategoryName}</span></>
                )}
              </p>
              {/* Breadcrumb trail in main area */}
              {breadcrumb.length > 0 && (
                <div className="flex items-center gap-1.5 mt-0.5 overflow-x-auto no-scrollbar whitespace-nowrap hidden md:flex">
                  <button onClick={() => handleBreadcrumbClick(-1)} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">All</button>
                  {breadcrumb.map((crumb, idx) => (
                    <span key={crumb._id} className="flex items-center gap-1">
                      <ChevronRight className="size-3 text-[var(--glass-border)]" />
                      <button onClick={() => handleBreadcrumbClick(idx)} className={`text-[10px] transition-colors ${idx === breadcrumb.length - 1 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sort & View Toggle */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3 border-t md:border-t-0 border-[var(--glass-border)] pt-3 md:pt-0 mt-1 md:mt-0">
              
              {/* Filter Button for Mobile */}
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-md text-[10px] font-medium text-[var(--text-primary)] shadow-sm shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filters
              </button>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap hidden lg:block">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-transparent border border-[var(--glass-border)] rounded-md py-1.5 px-3 text-[11px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all cursor-pointer hover:bg-[var(--bg-secondary)]/50 appearance-none pr-7 bg-no-repeat bg-[right_0.5rem_top_50%] bg-[length:0.65rem] shadow-sm max-w-[120px] sm:max-w-none text-ellipsis"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")` }}
                >
                  <option value="-createdAt">Newest Arrivals</option>
                  <option value="price">Price: Low to High</option>
                  <option value="-price">Price: High to Low</option>
                  <option value="-rating">Highest Rated</option>
                </select>
              </div>
              
              <div className="h-4 w-px bg-[var(--glass-border)] hidden sm:block" />
              
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-md p-0.5 border border-[var(--glass-border)] shrink-0">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-[4px] transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  <LayoutGrid className="size-3.5" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-[4px] transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="p-4 md:p-6 lg:p-12">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
                {[1,2,3,4,5,6,7,8,9,10].map(i => (
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
                <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-6 mb-12" : "flex flex-col gap-4 mb-12 mx-auto max-w-4xl"}>
                  {products.map(product => (
                    <ProductCard key={product._id} product={product} layout={viewMode} />
                  ))}
                </div>

                {/* --- Pagination --- */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-12 pb-12">
                     <button 
                        disabled={page === 1}
                        onClick={() => handlePageChange(page - 1)}
                        className="px-6 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black tracking-widest uppercase disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-all transition-colors"
                     >
                        Previous
                     </button>
                     <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                           // Show only 5 pages around current
                           if (Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) return p === 2 || p === totalPages - 1 ? <span key={p} className="opacity-30">...</span> : null;
                           return (
                              <button 
                                 key={p}
                                 onClick={() => handlePageChange(p)}
                                 className={`size-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${page === p ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]'}`}
                              >
                                 {p}
                              </button>
                           );
                        })}
                     </div>
                     <button 
                        disabled={page === totalPages}
                        onClick={() => handlePageChange(page + 1)}
                        className="px-6 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black tracking-widest uppercase disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-all transition-colors"
                     >
                        Next
                     </button>
                  </div>
                )}
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin size-8 border-2 border-[var(--accent)] rounded-full border-t-transparent" /></div>}>
      <ShopContent />
    </Suspense>
  );
}


