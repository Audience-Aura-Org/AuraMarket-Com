"use client";

import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { 
  Compass, User, Store,
  Search, X, Home, ChevronRight, ShoppingBag,
  Activity, Circle, LayoutGrid, List, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import dynamic from 'next/dynamic';

import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/common/Pagination';
import VendorListPanel from '@/components/hub/VendorListPanel';
import AuraAssistant from '@/components/onboarding/AuraAssistant';
import StatusRow from '@/components/status/StatusRow';
import StatusTabGrid from '@/components/status/StatusTabGrid';

// ── Lazy-loaded components (Modals/Hidden Tabs) ────────────────────────
const StatusViewer = dynamic(() => import('@/components/status/StatusViewer'), { ssr: false });
const StatusCreator = dynamic(() => import('@/components/status/StatusCreator'), { ssr: false });

// Shared tab data for sub-pages
const ProfileContent = dynamic(() => import('./HubSubTabs').then(mod => mod.ProfileContent), { ssr: false });
const OrdersContent = dynamic(() => import('./HubSubTabs').then(mod => mod.OrdersContent), { ssr: false });
const WishlistContent = dynamic(() => import('./HubSubTabs').then(mod => mod.WishlistContent), { ssr: false });

const TABS = [
  { id: 'vendors', icon: Store, label: 'Vendors' },
  { id: 'discover', icon: Compass, label: 'Discover' },
  { id: 'status', icon: Activity, label: 'Status' },
  { id: 'profile', icon: User, label: 'Profile' },
];

const PRICE_RANGES = [
  { id: 'under-5000', name: 'Under 5,000 XAF', min: 0, max: 5000 },
  { id: '5000-10000', name: '5,000 - 10,000 XAF', min: 5000, max: 10000 },
  { id: '10000-50000', name: '10,000 - 50,000 XAF', min: 10000, max: 50000 },
  { id: 'over-50000', name: 'Over 50,000 XAF', min: 50000, max: 9999999 },
];

const SORT_OPTIONS = [
  { value: '-view_count', label: 'Most Popular' },
  { value: '-createdAt', label: 'Newest Arrivals' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: '-rating', label: 'Highest Rated' }
];

// ── DISCOVER TAB (Synced with Shop + Followed Only) ──────────────────
const DiscoveryContent = memo(({ user, statuses, onSelectStatus, onAddStatus }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTree, setCategoryTree] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activePrice, setActivePrice] = useState(null);
  const [sortBy, setSortBy] = useState('-view_count');
  const [viewMode, setViewMode] = useState('grid');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const limit = 24;

  const resultsAnchor = useRef(null);

  // Initial resources
  useEffect(() => {
    const loadResources = async () => {
      setIsCategoriesLoading(true);
      try {
        const res = await api.get('/categories/with-products');
        if (res.data.success) setCategoryTree(res.data.data);
      } catch (e) { console.error(e); }
      finally { setIsCategoriesLoading(false); }
    };
    loadResources();
  }, []);

  // Fetch logic strictly for followed vendors
  const fetchProducts = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = { limit, page: targetPage, followedOnly: true };
      if (activeCategoryName !== 'All') params.category = activeCategoryName;
      if (search) params.search = search;
      if (sortBy) params.sort = sortBy;
      if (activePrice) {
        const range = PRICE_RANGES.find(p => p.id === activePrice);
        params.minPrice = range.min;
        params.maxPrice = range.max;
      }
      
      const res = await api.get('/products/hub', { params });
      if (res.data.success) {
        const items = res.data.data.products || [];
        setProducts(items);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeCategoryName, search, page, sortBy, activePrice]);

  // Trigger fetch: Sync with Shop logic (immediate for filters, debounced for search)
  useEffect(() => {
    fetchProducts(1);
  }, [activeCategoryName, activePrice, sortBy, search]);

  useEffect(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  const handleCategoryClick = (cat) => {
    setBreadcrumb(prev => [...prev, cat]);
    setActiveCategoryId(cat._id);
    setActiveCategoryName(cat.name);
    setPage(1);
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
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
    setPage(1);
  };



  useEffect(() => {
    const handleGlobalUpdate = () => fetchProducts(1);
    window.addEventListener('aura_follow_update', handleGlobalUpdate);
    return () => window.removeEventListener('aura_follow_update', handleGlobalUpdate);
  }, [fetchProducts]);

  // Click outside to close dropdowns
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

  const currentLevel = useMemo(() => {
    return breadcrumb.length === 0 ? categoryTree : breadcrumb[breadcrumb.length - 1].children || [];
  }, [breadcrumb, categoryTree]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col bg-[var(--bg-secondary)] pb-40">
      
      {/* Sticky Header below replaces the relative stories row */}

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)] shadow-sm">
        {/* Search */}
        <div className="px-6 lg:px-12 py-3 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search followed vendors..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-5 pr-12 text-[10px] md:text-sm outline-none transition-all font-medium focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5"
            />
            <button className="absolute right-1 top-1 h-[calc(100%-8px)] px-5 bg-[var(--accent)] text-white rounded-full shadow-lg hover:opacity-90 flex items-center justify-center font-bold">
              <Search className="size-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
          <div className="max-w-7xl px-6 lg:px-12 py-3 flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar w-full">
             {isCategoriesLoading ? (
               [...Array(6)].map((_, i) => <div key={i} className="shrink-0 w-24 h-9 rounded-full bg-[var(--bg-secondary)] animate-pulse" />)
             ) : (
               <>
                 {breadcrumb.length > 0 ? (
                   <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[11px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                     <Home className="size-3.5" /> Market
                   </button>
                 ) : (
                    <button 
                      onClick={() => handleBreadcrumbClick(-1)}
                      className={`shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-[11px] md:text-sm font-normal tracking-tight shadow-sm ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                    >
                      All
                    </button>
                 )}

                 {breadcrumb.map((crumb, idx) => (
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
                         else { setActiveCategoryId(cat._id); setActiveCategoryName(cat.name); setPage(1); }
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

      {/* ── ACTION BAR (Synced with Shop) ── */}
      <div className="px-3 md:px-6 lg:px-12 py-1.5 md:py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-2 md:gap-3 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-1.5 md:gap-3">
          <h3 className="text-xs md:text-xl font-bold text-[var(--text-primary)] tracking-tight">
            {activeCategoryName === 'All' ? 'Global Discovery' : activeCategoryName}
          </h3>
          <div className="h-3 md:h-4 w-px bg-[var(--glass-border)]" />
          <p className="text-[10px] md:text-[11px] font-medium text-[var(--text-secondary)] tracking-tight opacity-60">
            {products.length} Results
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto z-20">
          {/* Price Filter */}
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

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 px-2 py-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
             {[...Array(12)].map((_, i) => <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-white/5" />)}
          </div>
        ) : products.length > 0 ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-12" : "flex flex-col gap-4 mb-12 mx-auto max-w-4xl"}>
            {products.map(p => <ProductCard key={p._id} product={p} layout={viewMode} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center py-32 space-y-4">
            <div className="size-20 bg-[var(--accent)]/5 rounded-full flex items-center justify-center">
              <ShoppingBag className="size-10 text-[var(--accent)] opacity-20" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic">No Followed Items</h2>
              <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40 max-w-[280px] mx-auto mt-2">
                Follow more vendors to build your personal Discovery feed.<br/>
                Items of vendors followed should appear here according to popularity.
              </p>
            </div>
            <button onClick={() => { setActiveCategoryName('All'); setActivePrice(null); setSearch(''); }} className="px-6 py-2 bg-[var(--accent)] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Reset Feed</button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-12">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
DiscoveryContent.displayName = 'DiscoveryContent';

export default function DiscoveryHub() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('discover');
  
  // Status States
  const [followedStatuses, setFollowedStatuses] = useState([]);
  const [viewingStatuses, setViewingStatuses] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showCreator, setShowCreator] = useState(false);

  const fetchFollowedStatuses = useCallback(async () => {
    try {
      const res = await api.get('/statuses', { 
        params: { mode: user ? 'followed' : 'global', limit: 20 } 
      });
      if (res.data.success) {
        const data = res.data.data || [];
        setFollowedStatuses(data);
        
        // Aggressive background preloading for instant zero-latency viewing
        data.forEach(s => {
          if (s.type === 'image' && s.content_url) {
            const img = new Image();
            img.src = s.content_url;
          }
        });
      }
    } catch (e) { 
      console.error('[Hub] Failed to fetch statuses:', e); 
      setFollowedStatuses([]);
    }
  }, [user]);

  useEffect(() => {
    fetchFollowedStatuses();
  }, [fetchFollowedStatuses]);


  useEffect(() => {
    const lastTab = sessionStorage.getItem('aura_hub_active_tab');
    if (lastTab) setActiveTab(lastTab);
  }, []);


  const handleTabChange = (id) => {
    setActiveTab(id);
    sessionStorage.setItem('aura_hub_active_tab', id);
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] flex flex-col pt-[env(safe-area-inset-top)]">
      <AuraAssistant user={user} />
      <div className="flex-1">
        <div className={activeTab === 'vendors' ? 'block' : 'hidden'}>
          <div className="flex flex-col relative">
            {(followedStatuses?.length > 0 || user?.role === 'vendor') && (
              <div className="sticky top-0 z-[35] bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border-b border-white/5 shadow-sm overflow-hidden">
                <StatusRow 
                  statuses={followedStatuses} 
                  onSelect={(items, storyId) => {
                    setViewingStatuses(items);
                    setSelectedStoryId(storyId);
                  }}
                  onAdd={() => setShowCreator(true)}
                  isVendor={user?.role === 'vendor'}
                />
              </div>
            )}
            <div className="flex flex-col pb-40">
              <VendorListPanel 
                followedStatuses={followedStatuses} 
                onOpenStatus={(vendorId) => {
                  const items = followedStatuses.filter(s => s.vendor_id?._id === vendorId);
                  if (items.length > 0) {
                    setViewingStatuses(followedStatuses);
                    setSelectedStoryId(items[0]._id);
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className={activeTab === 'discover' ? 'block' : 'hidden'}>
          <DiscoveryContent 
            user={user} 
            isActive={activeTab === 'discover'} 
            statuses={followedStatuses}
            onSelectStatus={(items) => setViewingStatuses(items)}
            onAddStatus={() => setShowCreator(true)}
          />
        </div>

        <div className={activeTab === 'status' ? 'block' : 'hidden'}>
          <StatusTabGrid onSelectStatus={(items, storyId) => {
            setViewingStatuses(items);
            setSelectedStoryId(storyId);
          }} />
        </div>

        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <ProfileContent user={user} onSelectTab={handleTabChange} />
        </div>

        {/* Status Overlays */}
        <AnimatePresence>
          {viewingStatuses && (
            <StatusViewer 
              initialStatuses={viewingStatuses}
              initialStoryId={selectedStoryId}
              onClose={() => {
                setViewingStatuses(null);
                setSelectedStoryId(null);
              }} 
            />
          )}
          {showCreator && (
            <StatusCreator 
              onClose={() => setShowCreator(false)}
              onStatusCreated={(newStatus) => {
                fetchFollowedStatuses();
                setShowCreator(false);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── THE DISCOVERY BOTTOM NAV ──
          Replaces the global BottomNav with discovery-specific context.
          Blends with the platform aesthetic but keeps the high-density tabs.
      */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] w-full backdrop-blur-2xl bg-white/[0.02] border-t border-white/[0.08] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] rounded-t-[32px] overflow-hidden sm:hidden">
        <div className="flex items-center justify-around h-[72px] px-2 pb-2 pt-1 relative">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 relative ${
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-500 ${isActive ? 'bg-[var(--accent)]/10 scale-105 shadow-lg shadow-[var(--accent)]/10' : ''}`}>
                  <Icon className={`size-5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                  )}
                </div>
                
                <span className={`text-[10px] font-bold mt-1 transition-all ${
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}>
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div 
                    layoutId="hub-indicator" 
                    className="absolute bottom-0 inset-x-8 h-[3px] bg-[var(--accent)] rounded-full shadow-[0_0_12px_var(--accent)]" 
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Floating Dock Fallback */}
      <nav className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg">
        <div className="flex items-center h-[58px] bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-1.5 overflow-hidden">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <div key={tab.id} className="flex-1 flex items-center h-full">
                {idx > 0 && <div className="w-px h-3 bg-white/10" />}
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 relative ${
                    isActive ? 'text-[var(--accent)]' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                   <Icon className={`size-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                   <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">{tab.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

