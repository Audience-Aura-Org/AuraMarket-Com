"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import nextDynamic from 'next/dynamic';
import { Activity } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import StatusTabGrid from '@/components/status/StatusTabGrid';
import { buildStatusSequences, markStatusViewed } from '@/components/status/statusSequences';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const StatusViewer = nextDynamic(() => import('@/components/status/StatusViewer'), { ssr: false });

function StatusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authChecked } = useAuthStore();

  useEffect(() => {
    if (authChecked && !user) router.replace('/login');
  }, [authChecked, user, router]);

  const [viewingStatuses, setViewingStatuses] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [viewedStoryIds, setViewedStoryIds] = useState([]);
  const sharedStoryIdRef = useRef(null);

  // Auto-open a shared story from ?story=[id]
  useEffect(() => {
    const storyId = searchParams.get('story');
    if (!storyId || sharedStoryIdRef.current === storyId) return;
    sharedStoryIdRef.current = storyId;

    api.get(`/statuses/story/${storyId}`)
      .then((res) => {
        const story = res.data?.data;
        if (!story?._id) return;
        const relatedStories = Array.isArray(story.vendorStories) && story.vendorStories.length > 0
          ? story.vendorStories
          : [story];
        setViewingStatuses(relatedStories);
        setSelectedStoryId(story._id);
      })
      .catch(() => {});
  }, [searchParams]);

  const markStoryViewed = useCallback((storyId) => {
    if (!storyId) return;
    setViewedStoryIds((prev) => prev.includes(storyId) ? prev : [...prev, storyId]);
    setViewingStatuses((prev) => prev ? markStatusViewed(prev, storyId) : prev);
  }, []);

  const openStatusSequence = useCallback((items, storyId) => {
    if (!Array.isArray(items) || !items.length || !storyId) return;
    markStoryViewed(storyId);
    setViewingStatuses(markStatusViewed(items, storyId));
    setSelectedStoryId(storyId);
  }, [markStoryViewed]);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] pb-[max(5rem,env(safe-area-inset-bottom,1.25rem))]">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Activity className="size-4 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">Stories</h1>
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 tracking-[0.15em]">Live Vendor Updates</p>
          </div>
        </div>
      </div>


      {/* Stories grid */}
      <StatusTabGrid
        viewedStoryIds={viewedStoryIds}
        onSelectStatus={(items, storyId) => openStatusSequence(items, storyId)}
        onAdd={null}
        isCreator={false}
      />

      {/* Story viewer overlay */}
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
      </AnimatePresence>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StatusPageContent />
    </Suspense>
  );
}
