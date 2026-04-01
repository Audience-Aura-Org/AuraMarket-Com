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
  { id: 'under-5000', name: 'Under 5K XAF', min: 0, max: 5000 },
  { id: '5000-10000', name: '5K - 10K XAF', min: 5000, max: 10000 },
  { id: '10000-50000', name: '10K - 50K XAF', min: 10000, max: 50000 },
  { id: 'over-50000', name: '50K+ XAF', min: 50000, max: 9999999 },
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
    const params = { page: targetPage, limit: 20 };
    if (activeCategoryName && activeCategoryName !== 'All') params.category = activeCategoryName;
    if (activePrice) {
      const range = PRICE_RANGES.find(p => p.id === activePrice);
      params.minPrice = range.min;
      params.maxPrice = range.max;
    }
    if (search) params.search = search;
    if (sortBy) params.sort = sortBy;

    setLoading(true);
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

  const handleCategoryClick = (cat) => {
    setBreadcrumb(prev => [...prev, cat]);
    setActiveCategoryId(cat._id);
    setActiveCategoryName(cat.name);
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
      setBreadcrumb([]);
      setActiveCategoryId(null);
      setActiveCategoryName('All');
    } else {
      const next = breadcrumb.slice(0, idx + 1);
      setBreadcrumb(next);
      const last = next[next.length - 1];
      setActiveCategoryId(last._id);
      setActiveCategoryName(last.name);
    }
  };

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col">
      {/* Search Header - Reduced padding to prevent "empty space" feel with cart sidebar */}
      <div className="bg-[var(--bg-primary)] border-b border-[var(--glass-border)] py-3 px-4 lg:px-8 sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-black tracking-widest text-[var(--accent)] uppercase shrink-0">
            <MapPin className="size-3" /> Aura Hub
          </div>
          
          <div className="flex-1 relative min-w-[200px]">
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search premium nodes..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2 px-4 pl-10 text-xs font-bold outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30" />
          </div>

          <button onClick={() => setIsFilterOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[10px] font-black uppercase">Filters</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Consistent with 2afc6a4 logic */}
        <aside className={`
          fixed lg:relative inset-y-0 left-0 z-[60] lg:z-10
          w-64 bg-[var(--bg-primary)] border-r border-[var(--glass-border)]
          transition-transform duration-300 lg:translate-x-0
          ${isFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto no-scrollbar
        `}>
           {isFilterOpen && <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsFilterOpen(false)} />}
           <div className="p-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40 mb-6">Discovery Protocol</h3>
              
              <div className="space-y-1 mb-8">
                <button onClick={() => handleBreadcrumbClick(-1)} className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold ${activeCategoryId === null ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>All Categories</button>
                {currentLevel.map(cat => (
                  <button key={cat._id} onClick={() => cat.children?.length ? handleCategoryClick(cat) : (setActiveCategoryId(cat._id), setActiveCategoryName(cat.name), setIsFilterOpen(false))} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold ${activeCategoryId === cat._id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                    <span>{cat.name}</span>
                    {cat.children?.length > 0 && <ChevronRight className="size-3" />}
                  </button>
                ))}
              </div>

              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40 mb-6 font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40 mb-6">Price Spectrum</h3>
              <div className="space-y-2">
                {PRICE_RANGES.map(range => (
                  <button key={range.id} onClick={() => setActivePrice(activePrice === range.id ? null : range.id)} className={`flex items-center gap-3 text-[11px] font-bold w-full text-left ${activePrice === range.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                    <div className={`size-3.5 rounded border ${activePrice === range.id ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--glass-border)]'}`}>
                      {activePrice === range.id && <Check className="size-2.5 m-auto" />}
                    </div>
                    {range.name}
                  </button>
                ))}
              </div>
           </div>
        </aside>

        {/* Main Content - Expanded to fill space properly */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between mb-8 px-1">
             <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Product Grid</h2>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{products.length} Results Found</p>
             </div>
             <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-2 px-4 text-[10px] font-black tracking-widest uppercase outline-none">
                <option value="-createdAt">Newest</option>
                <option value="price">Price: Low</option>
                <option value="-price">Price: High</option>
             </select>
          </div>

          {loading ? (
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] animate-pulse" />)}
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-5">
               {products.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 mb-20">
               <button disabled={page === 1} onClick={() => setPage(page-1)} className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] disabled:opacity-20 flex items-center justify-center"><ChevronLeft className="size-4" /></button>
               <span className="text-[11px] font-black px-4">PAGE {page} / {totalPages}</span>
               <button disabled={page === totalPages} onClick={() => setPage(page+1)} className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] disabled:opacity-20 flex items-center justify-center"><ChevronRight className="size-4" /></button>
            </div>
          )}
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
