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
    // Provide immediate feedback by setting loading
    setLoading(true);

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
  }, [page, activeCategoryName, activePrice, sortBy, search]);

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
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30 font-[var(--font-poppins)]">
        <div className="flex flex-col w-full min-h-[calc(100vh-140px)] relative">
        
        {/* SEARCH COMPONENT (Scrolls Away) */}
        <div className="px-4 md:px-6 lg:px-12 py-6 bg-[var(--bg-primary)] flex justify-center border-b border-[var(--glass-border)]/50">
          <div className="relative w-full max-w-6xl">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchProducts(1); } }}
              placeholder="Search for products..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-4 pr-14 text-xs focus:ring-1 focus:ring-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
            />
            <button
              onClick={() => { setPage(1); fetchProducts(1); }}
              className="absolute right-1.5 top-1.5 h-[calc(100%-12px)] px-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full shadow-md hover:opacity-90 transition-all flex items-center justify-center font-bold"
            >
              <Search className="size-3.5" />
            </button>
          </div>
        </div>

        {/* STICKY CATEGORY NAV (Stays Fixed on Scroll) */}
        <div className="sticky top-[56px] md:top-[72px] z-40 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)] py-3 px-4 md:px-6 lg:px-12 shadow-sm transition-all">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full">
             {breadcrumb.length > 0 ? (
               <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 md:py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[10px] md:text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                 <Home className="size-3 lg:size-3.5" /> Home
               </button>
             ) : (
                <button 
                  onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }}
                  className={`shrink-0 px-4 md:px-5 py-1.5 md:py-2 rounded-full border transition-all text-[10px] md:text-[11px] font-medium shadow-sm ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                >
                  All
                </button>
             )}

             {breadcrumb.length > 0 && breadcrumb.map((crumb, idx) => (
               <div key={crumb._id} className="flex items-center gap-2 shrink-0">
                  <ChevronRight className="size-3 text-[var(--glass-border)] hidden sm:block" />
                  <button 
                    onClick={() => handleBreadcrumbClick(idx)} 
                    className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full border transition-all text-[10px] md:text-[11px] font-medium shadow-sm ${idx === breadcrumb.length - 1 && currentLevel.length === 0 ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {crumb.name}
                  </button>
               </div>
             ))}

             {breadcrumb.length > 0 && currentLevel.length > 0 && <div className="h-4 w-px bg-[var(--glass-border)] mx-1 shrink-0 hidden sm:block" />}

             {currentLevel.map(cat => (
               <button
                  key={cat._id}
                  onClick={() => {
                    if (cat.children && cat.children.length > 0) handleCategoryClick(cat);
                    else { setActiveCategoryId(cat._id); setActiveCategoryName(cat.name); }
                  }}
                  className={`shrink-0 px-4 md:px-5 py-1.5 md:py-2 rounded-full border transition-all text-[10px] md:text-[11px] font-medium shadow-sm ${activeCategoryId === cat._id ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}`}
               >
                 {cat.name}
               </button>
             ))}
          </div>
        </div>


        {/* ── MAIN CONTENT ── */}
        <main ref={resultsAnchor} className="flex-1 bg-[var(--bg-secondary)] min-h-screen transition-colors duration-500 overflow-hidden pt-[1px]">
          
          {/* Results Info & Action Bar */}
          <div className="px-4 md:px-6 lg:px-12 py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-3 bg-[var(--bg-secondary)]">
            
            <p className="text-[10px] md:text-xs font-medium text-[var(--text-secondary)] tracking-tight whitespace-nowrap shrink-0">
              <span className="text-[var(--text-primary)] font-semibold">{products.length}</span> <span className="hidden sm:inline">products found</span>
              {activeCategoryName !== 'All' && <span className="hidden lg:inline"> in <span className="text-[var(--text-primary)] font-semibold">{activeCategoryName}</span></span>}
            </p>

            <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-auto dropdown-container relative z-20">
              
              {/* PRICE FILTERS */}
              <div className="relative">
                <button 
                  onClick={() => { setIsPriceOpen(!isPriceOpen); setIsSortOpen(false); }}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:py-2 rounded-lg border transition-all text-[10px] md:text-[11px] font-medium shadow-sm ${activePrice ? 'bg-[var(--bg-primary)] border-[var(--text-primary)] text-[var(--text-primary)]' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-[var(--text-secondary)] text-[var(--text-secondary)]'}`}
                >
                  {activePrice ? PRICE_RANGES.find(r => r.id === activePrice)?.name : 'Price'}
                  <ChevronRight className={`size-3 text-[var(--text-secondary)] transition-transform ${isPriceOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isPriceOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[14px] shadow-2xl overflow-hidden py-1.5 z-50">
                     <button onClick={() => {setActivePrice(null); setIsPriceOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center gap-2 ${!activePrice ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                       {!activePrice && <Check className="size-3" />} Any Price
                     </button>
                     {PRICE_RANGES.map(range => (
                       <button key={range.id} onClick={() => {setActivePrice(range.id); setIsPriceOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center gap-2 ${activePrice === range.id ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                         {activePrice === range.id && <Check className="size-3" />} {range.name}
                       </button>
                     ))}
                  </div>
                )}
              </div>

              {/* SORT DROPDOWN */}
              <div className="relative">
                <button 
                  onClick={() => { setIsSortOpen(!isSortOpen); setIsPriceOpen(false); }}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] md:text-[11px] font-medium text-[var(--text-primary)] shadow-sm"
                >
                  <span className="hidden sm:inline text-[var(--text-secondary)] font-normal">Sort:</span> 
                  {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                  <ChevronRight className={`size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                </button>
                
                {isSortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[14px] shadow-2xl overflow-hidden py-1.5 z-50">
                     {SORT_OPTIONS.map(opt => (
                       <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                         {opt.label}
                         {sortBy === opt.value && <Check className="size-3" />}
                       </button>
                     ))}
                  </div>
                )}
              </div>
              
              <div className="h-4 w-px bg-[var(--glass-border)] hidden sm:block mx-0.5" />
              
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--glass-border)]">
                <button onClick={() => setViewMode('grid')} className={`p-1 md:p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                  <LayoutGrid className="size-3.5" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1 md:p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
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


