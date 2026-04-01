"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { 
  Search, Star, LayoutGrid, 
  List, Check, ChevronRight, ChevronLeft, Folder, Home, MapPin, 
  Filter, SlidersHorizontal, ArrowUpDown, X, Package, Tag, Layers
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import api from '@/services/api';
import { trackSearch } from '@/services/tracking';

export const dynamic = 'force-dynamic';

const PRICE_RANGES = [
  { id: 'under-5000', name: 'Under 5K XAF', min: 0, max: 5000 },
  { id: '5000-10000', name: '5K - 10K XAF', min: 5000, max: 10000 },
  { id: '10000-50000', name: '10K - 50K XAF', min: 10000, max: 50000 },
  { id: 'over-50000', name: '50K+ XAF', min: 50000, max: 9999999 },
];

function ShopContent() {
  const router = useRouter();
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
  const [isFilterOpen, setIsFilterOpen] = useState(true); // Default open on desktop for "Dashboard" feel

  const [categoryTree, setCategoryTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); 
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');

  const currentLevel = breadcrumb.length === 0 ? categoryTree : breadcrumb[breadcrumb.length - 1].children;

  useEffect(() => {
    api.get('/categories/with-products')
      .then(res => { if (res.data.success) setCategoryTree(res.data.data); })
      .catch(err => console.error(err));
  }, []);

  const fetchProducts = useCallback(async (targetPage = page) => {
    setLoading(true);
    const params = { page: targetPage, limit: 20 };
    if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
    if (activePrice) {
      const range = PRICE_RANGES.find(p => p.id === activePrice);
      params.minPrice = range.min;
      params.maxPrice = range.max;
    }
    if (search) params.search = search;
    if (sortBy) params.sort = sortBy;

    try {
      const res = await api.get('/products', { params });
      if (res.data.success) {
        setProducts(res.data.data.products || []);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeCategoryName, activePrice, sortBy, search, page]);

  useEffect(() => { fetchProducts(page); }, [page, activeCategoryName, activePrice, sortBy]);
  useEffect(() => { setPage(1); }, [activeCategoryName, activePrice, sortBy, search]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] selection:bg-[var(--accent)]/30">
      
      {/* ── SEARCH HEADER ─────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
           <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`size-9 rounded-xl border border-[var(--glass-border)] flex items-center justify-center transition-all ${isFilterOpen ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
              <SlidersHorizontal className="size-4" />
           </button>
           <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] hidden md:block">HUB PROTOCOL</h1>
        </div>

        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)] opacity-30" />
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="INTERCEPT SIGNAL..."
            className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl py-2 pl-10 pr-4 text-[10px] font-black tracking-[0.1em] uppercase focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all placeholder:opacity-20"
          />
        </div>

        <div className="flex items-center gap-4">
           {/* VIEW MODE */}
           <div className="hidden sm:flex items-center gap-1 p-1 bg-[var(--bg-secondary)]/80 rounded-xl border border-[var(--glass-border)]">
              <button onClick={() => setViewMode('grid')} className={`size-7 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] opacity-30 hover:opacity-100'}`}><LayoutGrid className="size-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`size-7 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] opacity-30 hover:opacity-100'}`}><List className="size-3.5" /></button>
           </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* ── FILTER RAIL (PUSHABLE) ─────────────────────────── */}
        <aside 
          className={`
            fixed lg:relative inset-y-0 left-0 z-40 bg-[var(--bg-primary)] border-r border-[var(--glass-border)]
            transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
            ${isFilterOpen ? 'w-[280px] opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:border-none pointer-events-none'}
          `}
        >
          <div className="w-[280px] h-full flex flex-col p-6 overflow-y-auto no-scrollbar">
             
             {/* BREADCRUMB / LEVEL */}
             <div className="mb-6">
                <div className="flex items-center gap-2 text-[8px] font-black text-[var(--accent)] uppercase tracking-widest mb-4">
                   <Layers className="size-3" /> DIRECTORY DEPTH
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-black tracking-widest uppercase">
                   <button onClick={() => handleBreadcrumbClick(-1)} className={`hover:text-[var(--accent)] transition-colors ${breadcrumb.length === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>ROOT</button>
                   {breadcrumb.map((c, i) => (
                     <span key={c._id} className="flex items-center gap-1">
                        <ChevronRight className="size-2.5 text-[var(--glass-border)]" />
                        <button onClick={() => handleBreadcrumbClick(i)} className={`hover:text-[var(--accent)] transition-colors ${i === breadcrumb.length-1 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>{c.name}</button>
                     </span>
                   ))}
                </div>
             </div>

             {/* NODES (CATEGORIES) */}
             <div className="mb-8">
                <p className="text-[7px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em] mb-3">NODE SELECTION</p>
                <div className="space-y-1">
                   {currentLevel.map(cat => (
                     <button
                       key={cat._id}
                       onClick={() => cat.children?.length ? handleCategoryClick(cat) : (setActiveCategoryId(cat._id), setActiveCategoryName(cat.name))}
                       className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${activeCategoryId === cat._id ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                     >
                       <span className="truncate">{cat.name}</span>
                       {cat.children?.length > 0 && <ChevronRight className="size-3 opacity-30" />}
                     </button>
                   ))}
                </div>
             </div>

             {/* PRICE SPECTRUM */}
             <div className="mb-8">
                <p className="text-[7px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em] mb-4">PRICE SPECTRUM</p>
                <div className="grid grid-cols-1 gap-1.5">
                   {PRICE_RANGES.map(range => (
                     <button
                        key={range.id}
                        onClick={() => setActivePrice(activePrice === range.id ? null : range.id)}
                        className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activePrice === range.id ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30 text-[var(--accent)]' : 'bg-[var(--bg-secondary)]/50 border-transparent text-[var(--text-secondary)] hover:border-[var(--glass-border)]'}`}
                     >
                        <span className="text-[9px] font-black tracking-widest">{range.name}</span>
                        <div className={`size-3 rounded flex items-center justify-center transition-all ${activePrice === range.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)] group-hover:border-[var(--accent)]/40'}`}>
                           {activePrice === range.id && <Check className="size-2.5" />}
                        </div>
                     </button>
                   ))}
                </div>
             </div>

             {/* SORTING */}
             <div>
                <p className="text-[7px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em] mb-4">ORDER PRIORITY</p>
                <select 
                   value={sortBy}
                   onChange={e => setSortBy(e.target.value)}
                   className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2.5 px-3 text-[9px] font-black tracking-widest uppercase outline-none focus:border-[var(--accent)]/40 transition-all text-[var(--text-primary)] cursor-pointer"
                >
                   <option value="-createdAt">Newest Entry</option>
                   <option value="price">Price Ascend</option>
                   <option value="-price">Price Descend</option>
                   <option value="-rating">Top Rated</option>
                </select>
             </div>
          </div>
        </aside>

        {/* ── FEED CONTAINER ─────────────────────────── */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-8 bg-[var(--bg-secondary)]">
           <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mb-8 sm:mb-10 px-1">
              <div>
                 <div className="flex items-center gap-2 mb-2">
                    <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    <p className="text-[9px] font-black text-[var(--accent)] uppercase tracking-[0.4em]">Signal Acquisition</p>
                 </div>
                 <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none italic">Discover Aura</h2>
              </div>
              <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)]">
                {products.length} OBJECTIVES DETECTED IN SECTOR
              </p>
           </div>

           {loading ? (
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] animate-pulse" />
                ))}
             </div>
           ) : products.length === 0 ? (
             <div className="py-32 flex flex-col items-center justify-center text-center">
                <div className="size-20 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center mb-6 shadow-xl"><Search className="size-8 text-[var(--accent)]/20" /></div>
                <h3 className="text-lg font-black uppercase tracking-tighter italic">Signal Lost</h3>
                <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-2">The current parameters yields no data points.</p>
                <button onClick={() => (setSearch(''), setActiveCategoryName('All'), setBreadcrumb([]))} className="mt-8 h-10 px-8 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl text-[9px] font-black tracking-widest uppercase hover:bg-[var(--accent)] hover:text-white transition-all shadow-lg shadow-black/5">Reset Frequency</button>
             </div>
           ) : (
             <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5" : "flex flex-col gap-3 max-w-4xl"}>
                {products.map(p => <ProductCard key={p._id} product={p} layout={viewMode} />)}
             </div>
           )}

           {/* PAGINATION PANEL */}
           {totalPages > 1 && (
             <div className="flex items-center justify-center gap-2 mt-20 mb-32">
                <button disabled={page === 1} onClick={() => setPage(page-1)} className="size-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] disabled:opacity-20 flex items-center justify-center hover:border-[var(--accent)] transition-all"><ChevronLeft className="size-4" /></button>
                <div className="h-9 px-4 flex items-center bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl">
                   <span className="text-[9px] font-black tracking-[0.2em]">PAGINATION : <span className="text-[var(--accent)]">{page}</span>  /  {totalPages}</span>
                </div>
                <button disabled={page === totalPages} onClick={() => setPage(page+1)} className="size-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] disabled:opacity-20 flex items-center justify-center hover:border-[var(--accent)] transition-all"><ChevronRight className="size-4" /></button>
             </div>
           )}
        </main>

      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]"><div className="animate-spin size-8 border-2 border-[var(--accent)] rounded-full border-t-transparent" /></div>}>
      <ShopContent />
    </Suspense>
  );
}
