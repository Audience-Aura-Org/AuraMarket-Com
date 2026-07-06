"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import nextDynamic from 'next/dynamic';
import { Activity, LogIn, UserPlus } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import StatusTabGrid from '@/components/status/StatusTabGrid';
import { buildStatusSequences, markStatusViewed } from '@/components/status/statusSequences';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const StatusViewer = nextDynamic(() => import('@/components/status/StatusViewer'), { ssr: false });

function StatusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

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
        {!user && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/login')}
              className="h-8 px-3 rounded-full border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-all flex items-center gap-1.5"
            >
              <LogIn className="size-3" />
              Log in
            </button>
            <button
              onClick={() => router.push('/register')}
              className="h-8 px-3 rounded-full bg-[var(--accent)] text-white text-[11px] font-semibold hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/20"
            >
              <UserPlus className="size-3" />
              Sign up
            </button>
          </div>
        )}
      </div>

      {/* Guest CTA banner — see followed vendor stories */}
      {!user && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--accent)] text-[18px]">auto_awesome</span>
          <p className="text-[11px] font-semibold text-[var(--text-secondary)] flex-1">
            <span className="text-[var(--text-primary)]">Sign in</span> to see stories from vendors you follow
          </p>
          <button
            onClick={() => router.push('/login')}
            className="text-[10px] font-bold text-[var(--accent)] hover:underline whitespace-nowrap"
          >
            Sign in
          </button>
        </div>
      )}

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
