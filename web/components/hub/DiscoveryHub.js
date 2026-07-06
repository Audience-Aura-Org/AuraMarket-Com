"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Compass, User, Store, Activity, LayoutDashboard, House
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/context/LanguageContext';

import VendorListPanel from '@/components/hub/VendorListPanel';
import AuraAssistant from '@/components/onboarding/AuraAssistant';
import StatusRow from '@/components/status/StatusRow';
import StatusTabGrid from '@/components/status/StatusTabGrid';
import { buildStatusSequences, markStatusViewed } from '@/components/status/statusSequences';
import { TOP_NAV_HEIGHT, TOP_NAV_HEIGHT_LG } from '@/components/layout/TopNav';

// â”€â”€ Lazy-loaded components (Modals/Hidden Tabs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatusViewer = dynamic(() => import('@/components/status/StatusViewer'), { ssr: false });
const StatusCreator = dynamic(() => import('@/components/status/StatusCreator'), { ssr: false });

// Shared tab data for sub-pages
const ProfileContent = dynamic(() => import('./HubSubTabs').then(mod => mod.ProfileContent), { ssr: false });

const TOP_STATUS_CACHE_KEY = 'aura_top_statuses_cache_v1';
const TOP_STATUS_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const readTopStatusCache = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOP_STATUS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - Number(parsed.ts || 0) > TOP_STATUS_CACHE_TTL_MS) {
      window.localStorage.removeItem(TOP_STATUS_CACHE_KEY);
      return [];
    }
    return parsed.data;
  } catch {
    return [];
  }
};

const writeTopStatusCache = (data) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOP_STATUS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
};

export default function DiscoveryHub({ initialTab = 'vendors' }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);

  const isCustomer = !user || user.role === 'customer';
  const dashboardHref = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'logistics' ? '/logistics/dashboard' : '/vendor/dashboard';

  const TABS = isCustomer ? [
    { id: 'discover', label: t('bottomNav.discovery', 'Discovery'), href: "/shop", icon: Compass },
    { id: 'vendors', label: t('bottomNav.vendors', 'Vendors'), icon: Store },
    { id: 'status', label: t('bottomNav.stories', 'Stories'), icon: Activity },
    { id: 'overtime', label: t('bottomNav.overtime', 'Overtime'), href: "/overtime", icon: House },
    { id: 'profile', label: t('bottomNav.profile', 'Profile'), icon: User }
  ] : [
    { id: 'dashboard', label: t('bottomNav.dashboard', 'Dashboard'), href: dashboardHref, icon: LayoutDashboard },
    { id: 'discover', label: t('bottomNav.discovery', 'Discovery'), href: "/shop", icon: Compass },
    { id: 'status', label: t('bottomNav.stories', 'Stories'), icon: Activity },
    { id: 'overtime', label: t('bottomNav.overtime', 'Overtime'), href: "/overtime", icon: House },
    { id: 'profile', label: t('bottomNav.profile', 'Profile'), icon: User }
  ];

  useEffect(() => {
    if (initialTab && initialTab !== 'discover') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // Status States
  const [followedStatuses, setFollowedStatuses] = useState(() => readTopStatusCache());
  const [viewingStatuses, setViewingStatuses] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [viewedStoryIds, setViewedStoryIds] = useState([]);
  const sharedStoryIdRef = useRef(null);

  // 1. Force blur on mount to dismiss any keyboards from previous screens
  useEffect(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  }, []);

  const fetchFollowedStatuses = useCallback(async () => {
    try {
      const res = await api.get('/statuses', { 
        params: { mode: user ? 'followed' : 'global', sort: 'new', limit: 20 } 
      });
      if (res.data.success) {
        const data = res.data.data || [];
        setFollowedStatuses(data);
        writeTopStatusCache(data);
        
        data.slice(0, 6).forEach((s) => {
          const previewUrl = s.type === 'video' ? s.thumbnail_url : s.content_url;
          if (!previewUrl) return;
          if (s.type === 'image' || s.type === 'video') {
            const img = new Image();
            img.fetchPriority = 'auto';
            img.src = previewUrl;
          }
        });
      }
    } catch (e) { 
      console.error('[Hub] Failed to fetch statuses:', e); 
      setFollowedStatuses((current) => current.length ? current : readTopStatusCache());
    }
  }, [user]);

  useEffect(() => {
    fetchFollowedStatuses();
  }, [fetchFollowedStatuses]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const storyId = params.get('story');
    if (!storyId || sharedStoryIdRef.current === storyId) return;

    sharedStoryIdRef.current = storyId;
    setActiveTab('status');

    let isMounted = true;
    api.get(`/statuses/story/${storyId}`)
      .then((res) => {
        const story = res.data?.data;
        if (!isMounted || !story?._id) return;

        setFollowedStatuses((current) => {
          if (current.some((item) => item._id === story._id)) return current;
          const next = [story, ...current].slice(0, 20);
          writeTopStatusCache(next);
          return next;
        });
        const relatedStories = Array.isArray(story.vendorStories) && story.vendorStories.length > 0
          ? story.vendorStories
          : [story];
        setViewingStatuses(relatedStories);
        setSelectedStoryId(story._id);
      })
      .catch((error) => {
        console.error('[Hub] Failed to open shared story:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.addEventListener('online', fetchFollowedStatuses);
    return () => window.removeEventListener('online', fetchFollowedStatuses);
  }, [fetchFollowedStatuses]);

  const markStoryViewed = useCallback((storyId) => {
    if (!storyId) return;
    setViewedStoryIds((current) => current.includes(storyId) ? current : [...current, storyId]);
    setFollowedStatuses((current) => {
      const next = markStatusViewed(current, storyId);
      writeTopStatusCache(next);
      return next;
    });
    setViewingStatuses((current) => current ? markStatusViewed(current, storyId) : current);
  }, []);

  const openStatusSequence = useCallback((items, storyId) => {
    if (!Array.isArray(items) || items.length === 0 || !storyId) return;
    markStoryViewed(storyId);
    setViewingStatuses(markStatusViewed(items, storyId));
    setSelectedStoryId(storyId);
  }, [markStoryViewed]);

  const handleTabChange = (id) => {
    const tab = TABS.find(t => t.id === id);
    if (tab && tab.href) {
      router.push(tab.href);
      return;
    }
    
    // Internal switch for instant feel
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.set('tab', id);
      window.history.pushState({}, '', url);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] flex flex-col pt-[env(safe-area-inset-top)]">
      <AuraAssistant user={user} />
      
      <main className="flex-1 relative">
        <AnimatePresence>
          {activeTab === 'vendors' && (
            <motion.div 
              key="vendors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col relative"
            >
              {(followedStatuses?.length > 0 || user?.role === 'vendor' || user?.role === 'logistics') && (
                <div
                  className="sticky z-[50] bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border-b border-white/5 shadow-sm overflow-hidden"
                  style={{ top: TOP_NAV_HEIGHT }}
                >
                  <StatusRow
                    statuses={followedStatuses}
                    onSelect={(items, storyId) => {
                      openStatusSequence(items, storyId);
                    }}
                    onAdd={() => setShowCreator(true)}
                    isVendor={user?.role === 'vendor' || user?.role === 'logistics'}
                  />
                </div>
              )}
              <div className="flex flex-col pb-40">
                <VendorListPanel 
                  followedStatuses={followedStatuses} 
                  onOpenStatus={(vendorId) => {
                    const group = buildStatusSequences(followedStatuses)
                      .find((sequence) => sequence.vendorId === vendorId);
                    const startId = (group?.firstUnviewed || group?.latestStory)?._id;
                    openStatusSequence(followedStatuses, startId);
                  }}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'status' && (
            <motion.div 
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {(followedStatuses?.length > 0 || user?.role === 'vendor' || user?.role === 'logistics') && (
                <div
                  className="sticky z-[50] bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border-b border-white/5 overflow-hidden"
                  style={{ top: TOP_NAV_HEIGHT }}
                >
                  <StatusRow
                    statuses={followedStatuses}
                    onSelect={(items, storyId) => {
                      openStatusSequence(items, storyId);
                    }}
                    onAdd={() => setShowCreator(true)}
                    isVendor={user?.role === 'vendor' || user?.role === 'logistics'}
                  />
                </div>
              )}
              <StatusTabGrid
                viewedStoryIds={viewedStoryIds}
                onSelectStatus={(items, storyId) => { openStatusSequence(items, storyId); }}
                onAdd={() => setShowCreator(true)}
                isCreator={user?.role === 'vendor' || user?.role === 'logistics'}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileContent user={user} onSelectTab={handleTabChange} />
            </motion.div>
          )}
        </AnimatePresence>

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
              onStoryViewed={(storyId) => markStoryViewed(storyId)}
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
      </main>

      {/* â”€â”€ THE Discovery BOTTOM NAV â”€â”€ */}
      <nav className="fixed bottom-0 left-0 right-0 z-[400] w-full overflow-hidden rounded-t-[24px] border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_8%,transparent),0_-8px_32px_-8px_rgba(0,0,0,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] sm:hidden dark:shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_10%,transparent),0_-10px_36px_-8px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative flex h-[68px] w-full items-center justify-around px-1 pt-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200 active:scale-[0.98] ${
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div
                  className={`relative rounded-xl p-1.5 transition-colors duration-200 ${
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
                      : "bg-transparent"
                  }`}
                >
                  <Icon className="size-5 shrink-0 stroke-2 transition-colors" />
                </div>

                <span
                  className={`max-w-full truncate px-0.5 text-[10px] font-medium leading-none tracking-tight transition-colors min-[380px]:text-[11px] font-[Poppins] ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] opacity-90"
                  }`}
                >
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="hub-indicator"
                    className="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-80"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Floating Dock Fallback */}
      <nav className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] w-full max-w-lg">
        <div className="flex items-center h-[54px] bg-black/50 backdrop-blur-2xl border border-white/10 rounded-[22px] shadow-[0_12px_40px_rgba(0,0,0,0.22)] px-1.5 overflow-hidden">
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
                   <Icon className={`size-[20px] ${isActive ? 'stroke-2 text-[var(--accent)]' : 'stroke-2 text-white/45'}`} />
                   <span className={`max-w-[82px] truncate text-[10px] font-medium tracking-tight mt-1.5 md:text-[11px] font-[Poppins] ${isActive ? 'text-[var(--accent)]' : 'text-white/45'}`}>{tab.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
