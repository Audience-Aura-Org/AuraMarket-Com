"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

const readTopStatusCache = (userId = null) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TOP_STATUS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed?.data || parsed.userId !== (userId?.toString?.() || 'guest') || Date.now() - Number(parsed.ts || 0) > TOP_STATUS_CACHE_TTL_MS) {
      window.localStorage.removeItem(TOP_STATUS_CACHE_KEY);
      return [];
    }
    return parsed.data;
  } catch {
    return [];
  }
};

const writeTopStatusCache = (data, userId = null) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOP_STATUS_CACHE_KEY, JSON.stringify({ ts: Date.now(), userId: userId?.toString?.() || 'guest', data }));
  } catch {}
};

export default function DiscoveryHub({ initialTab = 'vendors' }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);



  useEffect(() => {
    if (initialTab && initialTab !== 'discover') {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // Status States
  const [followedStatuses, setFollowedStatuses] = useState(() => readTopStatusCache(user?._id));
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
        writeTopStatusCache(data, user?._id);
        
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
      setFollowedStatuses((current) => current.length ? current : readTopStatusCache(user?._id));
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
          writeTopStatusCache(next, user?._id);
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
      writeTopStatusCache(next, user?._id);
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


  return (
    <div className="[&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-[var(--accent)] [&_a]:focus-visible:outline-offset-[-2px] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-[var(--accent)] [&_button]:focus-visible:outline-offset-[-2px] [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-[var(--accent)] relative min-h-screen bg-[var(--bg-secondary)] flex flex-col pt-[env(safe-area-inset-top)]">
      <AuraAssistant user={user} />
      
      <main className="flex-1 relative">
        <AnimatePresence>
          {activeTab === 'vendors' && (
            <motion.div 
              key="vendors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col relative"
            >
              {(followedStatuses?.length > 0 || user?.role === 'vendor' || user?.role === 'logistics') && (
                <div
                  className="sticky z-[50] bg-[var(--bg-secondary)]/80 border-b border-[var(--glass-border)] shadow-sm overflow-hidden"
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
              transition={{ duration: 0.15 }}
            >
              {(followedStatuses?.length > 0 || user?.role === 'vendor' || user?.role === 'logistics') && (
                <div
                  className="sticky z-[50] bg-[var(--bg-secondary)]/80 border-b border-[var(--glass-border)] overflow-hidden"
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
              transition={{ duration: 0.15 }}
            >
              {(followedStatuses?.length > 0 || user?.role === 'vendor' || user?.role === 'logistics') && (
                <div className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 overflow-hidden">
                  <StatusRow
                    statuses={followedStatuses}
                    onSelect={(items, storyId) => openStatusSequence(items, storyId)}
                    onAdd={() => setShowCreator(true)}
                    isVendor={user?.role === 'vendor' || user?.role === 'logistics'}
                  />
                </div>
              )}
              <ProfileContent user={user} onSelectTab={setActiveTab} />
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
    </div>
  );
}
