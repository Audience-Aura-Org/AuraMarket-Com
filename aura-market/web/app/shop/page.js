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
  const [sortBy, setSortBy] = useState('newest');

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

  // Debounce ref to avoid multiple overlapping fetches
  const fetchTimeout = useRef(null);
  const productCacheRef = useRef(new Map());

  // Memoize the fetcher to stabilize the dependency graph
  const fetchProducts = useCallback(async () => {
    // Clear any existing pending fetch to avoid overwhelming the server
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

    fetchTimeout.current = setTimeout(async () => {
      const params = {};
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
        setProducts(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get('/products', { params });
        if (res.data.success) {
          const nextProducts = res.data.data.products || [];
          setProducts(nextProducts);
          productCacheRef.current.set(queryKey, nextProducts);
        }
      } catch (err) {
        console.error('Shop fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce buffer
  }, [activeCategoryName, activePrice, sortBy, search]); 

  useEffect(() => {
    fetchProducts();
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

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] selection:bg-[var(--accent)]/30">
      {/* Search Header */}
      <div className="bg-[var(--bg-primary)] border-b border-[var(--glass-border)] py-3 px-4 md:px-6 lg:px-20 flex flex-wrap items-center gap-4 lg:gap-8 sticky top-[64px] md:top-[72px] z-40 transition-all">
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-[var(--accent)] whitespace-nowrap">
          <MapPin className="size-3" /> <span className="hidden xs:inline">DELIVER TO</span> AURA HUB
        </div>
        
        <div className="flex-1 min-w-[200px] relative order-last md:order-none w-full md:w-auto">
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                trackSearch(search);
                fetchProducts();
              }
            }}
            placeholder="Search for products..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg py-2 md:py-2.5 pl-4 pr-12 text-sm focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-bold"
          />
          <button onClick={fetchProducts} className="absolute right-1 top-1 h-[calc(100%-8px)] px-4 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent)]/80 transition-all">
            <Search className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-6 ml-auto">
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg text-[10px] font-black tracking-widest uppercase hover:text-[var(--accent)] transition-all"
          >
            Filters
          </button>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[8px] font-black text-[var(--text-secondary)] tracking-widest leading-none">MY</span>
            <span className="text-[10px] font-black text-[var(--text-primary)]">ORDERS</span>
          </div>
        </div>
      </div>

      <div className="flex w-full min-h-[calc(100vh-140px)]">
        {/* ── SIDEBAR (Desktop & Mobile Drawer) ── */}
        <aside className={`
          fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-10
          w-72 flex-shrink-0 bg-[var(--bg-primary)] flex-col py-6 px-0 lg:sticky top-0 lg:top-[125px] h-full lg:h-[calc(100vh-125px)] overflow-hidden transition-transform duration-300 lg:translate-x-0
          ${isFilterOpen ? 'translate-x-0 flex' : '-translate-x-full lg:flex'}
          lg:border-r lg:border-[var(--glass-border)]
        `}>
          {/* Mobile Overlay Background */}
          {isFilterOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" 
              onClick={() => setIsFilterOpen(false)}
            />
          )}

          {/* Mobile sidebar header */}
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
        <main className="flex-1 bg-[var(--bg-secondary)] min-h-screen transition-colors duration-500 overflow-hidden">
          {/* Results Info + Sort */}
          <div className="px-4 md:px-6 lg:px-12 py-4 md:py-6 border-b border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-4 bg-[var(--bg-primary)]/50 backdrop-blur-sm">
            <div className="text-center md:text-left">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Showing <span className="text-[var(--text-primary)] font-black">{products.length}</span> results
                {activeCategoryName !== 'All' && (
                  <> in <span className="text-[var(--accent)] font-black uppercase tracking-widest"> {activeCategoryName}</span></>
                )}
              </p>
              {/* Breadcrumb trail in main area */}
              {breadcrumb.length > 0 && (
                <div className="flex items-center gap-1 mt-1 justify-center md:justify-start overflow-x-auto no-scrollbar whitespace-nowrap">
                  <button onClick={() => handleBreadcrumbClick(-1)} className="text-[9px] font-black text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors uppercase tracking-widest">All</button>
                  {breadcrumb.map((crumb, idx) => (
                    <span key={crumb._id} className="flex items-center gap-1">
                      <ChevronRight className="size-2.5 text-[var(--glass-border)]" />
                      <button onClick={() => handleBreadcrumbClick(idx)} className={`text-[9px] font-black uppercase tracking-widest transition-colors ${idx === breadcrumb.length - 1 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}>
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full md:w-auto">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[10px] font-black text-[var(--text-secondary)] tracking-widest uppercase shrink-0">Sort By</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg py-2 px-4 text-[10px] font-black tracking-widest outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all cursor-pointer text-[var(--text-primary)] min-w-[140px]"
                >
                  <option value="newest">NEWEST ARRIVALS</option>
                  <option value="price-low">PRICE: LOW TO HIGH</option>
                  <option value="price-high">PRICE: HIGH TO LOW</option>
                  <option value="rating">AVG. REVIEWS</option>
                </select>
              </div>
              <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)]" />
              <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--glass-border)] self-end sm:self-auto">
                <button className="size-8 rounded-md bg-[var(--accent)] text-white flex items-center justify-center shadow-sm">
                  <LayoutGrid className="size-4" />
                </button>
                <button className="size-8 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center">
                  <List className="size-4" />
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-6">
                {products.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
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


