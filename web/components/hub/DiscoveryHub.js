"use client";

import { useState, useEffect, useMemo, memo } from 'react';
import { 
  Compass, User, Store,
  Search, X, Home, ChevronRight, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import dynamic from 'next/dynamic';

// ── Lazy-loaded components ──────────────────────────────────────────
const VendorListPanel = dynamic(() => import('@/components/hub/VendorListPanel'), { ssr: false });
const AuraAssistant = dynamic(() => import('@/components/onboarding/AuraAssistant'), { ssr: false });
const ProductCard = dynamic(() => import('@/components/ProductCard'), { ssr: false });
const Pagination = dynamic(() => import('@/components/common/Pagination'), { ssr: false });

// Shared tab data for sub-pages
const ProfileContent = dynamic(() => import('./HubSubTabs').then(mod => mod.ProfileContent), { ssr: false });
const OrdersContent = dynamic(() => import('./HubSubTabs').then(mod => mod.OrdersContent), { ssr: false });
const WishlistContent = dynamic(() => import('./HubSubTabs').then(mod => mod.WishlistContent), { ssr: false });

const TABS = [
  { id: 'vendors', icon: Store, label: 'Vendors' },
  { id: 'discover', icon: Compass, label: 'Discover' },
  { id: 'profile', icon: User, label: 'Profile' },
];

export default function DiscoveryHub() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('discover');

  // Redirect to login if not authenticated (safety check)
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // Remember last tab across sessions for perceived speed
  useEffect(() => {
    const lastTab = sessionStorage.getItem('aura_hub_active_tab');
    if (lastTab) setActiveTab(lastTab);
  }, []);

  // Don't render until auth is confirmed
  if (!user) return null;

  const handleTabChange = (id) => {
    setActiveTab(id);
    sessionStorage.setItem('aura_hub_active_tab', id);
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] flex flex-col">
      <AuraAssistant user={user} />

      <div className="sticky top-0 z-[100] bg-[var(--bg-primary)]/90 backdrop-blur-3xl border-b border-[var(--glass-border)] transition-all duration-500 shadow-xl shadow-black/5">
        <div className="w-full">
          <div className="max-w-[1200px] mx-auto flex items-center justify-around px-2 py-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                 <button
                   key={tab.id}
                   onClick={() => handleTabChange(tab.id)}
                   className={`
                     flex flex-col items-center justify-center gap-1.5 py-1.5 px-3 transition-all duration-300 relative group min-w-[64px]
                     ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
                   `}
                 >
                   <div className={`p-1.5 rounded-xl transition-all duration-300 relative ${
                     isActive ? 'bg-[var(--accent)]/10 scale-105 shadow-lg shadow-[var(--accent)]/5' : 'group-hover:bg-[var(--bg-secondary)]'
                   }`}>
                     <Icon className={`size-4.5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                     {isActive && (
                       <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full shadow-[0_0_8px_var(--accent)]" />
                     )}
                   </div>
                   <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                     {tab.label}
                   </span>
                   {isActive && (
                     <motion.div 
                       layoutId="nav-underline"
                       className="absolute -bottom-[6px] w-6 h-1 bg-[var(--accent)] rounded-full" 
                     />
                   )}
                 </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'vendors' && <VendorListPanel key="vendors" />}
          {activeTab === 'discover' && <DiscoveryContent key="discover" user={user} />}
          {activeTab === 'profile' && <ProfileContent key="profile" user={user} onSelectTab={handleTabChange} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── DISCOVER TAB (Optimized) ────────────────────────────────────────────────
const DiscoveryContent = memo(({ user }) => {
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
  const limit = 24;

  // Optimized parallel fetch
  useEffect(() => {
    let isMounted = true;
    const loadResources = async () => {
      setIsCategoriesLoading(true);
      setLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          api.get('/categories/with-products'),
          api.get('/products/hub', { params: { limit, page: 1 } })
        ]);
        
        if (isMounted) {
          if (cRes.data.success) setCategoryTree(cRes.data.data);
          if (pRes.data.success) {
            const all = [...(pRes.data.data.followedProducts || []), ...(pRes.data.data.products || [])];
            setProducts(all.filter((p, i, arr) => arr.findIndex(x => x._id === p._id) === i));
            setTotalPages(pRes.data.pagination?.pages || 1);
          }
        }
      } catch (e) {
        console.error('Hub load error:', e);
      } finally {
        if (isMounted) {
          setIsCategoriesLoading(false);
          setLoading(false);
        }
      }
    };
    loadResources();
    return () => { isMounted = false; };
  }, []);

  // Filter change fetch
  useEffect(() => {
    if (loading && page === 1 && activeCategoryName === 'All' && !search) return; // Skip initial run handled by loadResources
    
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const params = { limit, page };
        if (activeCategoryName !== 'All') params.category = activeCategoryName;
        if (search) params.search = search;
        
        const res = await api.get('/products/hub', { params });
        if (res.data.success) {
          const all = [...(res.data.data.followedProducts || []), ...(res.data.data.products || [])];
          setProducts(all.filter((p, i, arr) => arr.findIndex(x => x._id === p._id) === i));
          setTotalPages(res.data.pagination?.pages || 1);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };

    const timer = setTimeout(fetchFiltered, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [activeCategoryName, search, page]);

  const currentLevel = useMemo(() => {
    return breadcrumb.length === 0 ? categoryTree : breadcrumb[breadcrumb.length - 1].children || [];
  }, [breadcrumb, categoryTree]);

  const handleCategoryClick = (cat) => {
    if (cat.children && cat.children.length > 0) {
      setBreadcrumb(p => [...p, cat]);
    } else {
      setActiveCategoryId(cat._id);
      setActiveCategoryName(cat.name);
      setPage(1);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto flex flex-col">
      {/* Search Bar */}
      <div className="sticky top-[60px] z-40 bg-[var(--bg-primary)] px-4 py-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2 pl-4 pr-12 text-[10px] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-[104px] z-40 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] py-2.5 px-4 scrollbar-hide">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {isCategoriesLoading ? (
            [...Array(6)].map((_, i) => <div key={i} className="shrink-0 w-16 h-7 rounded-full bg-[var(--bg-secondary)] animate-pulse" />)
          ) : (
            <>
              <button 
                onClick={() => { setBreadcrumb([]); setActiveCategoryId(null); setActiveCategoryName('All'); setPage(1); }}
                className={`shrink-0 px-3 py-1.5 rounded-full border transition-all text-[9.5px] font-black tracking-tighter ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-transparent text-[var(--text-secondary)]'}`}
              >
                All
              </button>
              {currentLevel.map(cat => (
                <button
                  key={cat._id}
                  onClick={() => handleCategoryClick(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full border transition-all text-[9.5px] font-black tracking-tighter ${activeCategoryId === cat._id ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Loader or Grid */}
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
             {[...Array(12)].map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-[var(--bg-primary)] animate-pulse" />)}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-secondary)]">
            <ShoppingBag className="size-12 mb-4 opacity-20" />
            <p className="font-bold">No items found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});
DiscoveryContent.displayName = 'DiscoveryContent';
