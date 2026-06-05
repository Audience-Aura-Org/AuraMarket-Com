"use client";
import { useState, useEffect, useRef, useCallback, memo, useMemo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, Heart, ShoppingBag,
  Volume2, VolumeX,
  Eye, Send, Share2, Pause, Play, Loader2, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

const STORY_DURATION = 5000;
const VIDEO_PRELOAD_AHEAD = 1;
const VIDEO_WAIT_TIMEOUT_MS = 6000;

// ─── Preload helper ──────────────────────────────────────────────────────────
const preloadCache = new Set();
const videoPreloadMap = new Map();
function preloadMedia(url, type, { eager = false } = {}) {
  if (!url || preloadCache.has(url)) return;
  preloadCache.add(url);
  if (type === 'video') {
    const existing = videoPreloadMap.get(url);
    if (existing) {
      if (eager && existing.preload !== 'auto') {
        existing.preload = 'auto';
        existing.load();
      }
      return;
    }
    const v = document.createElement('video');
    v.preload = eager ? 'metadata' : 'none';
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.load();
    videoPreloadMap.set(url, v);

    // Avoid <link rel="preload" for story videos. It can download large files
    // before a shopper opens them, which increases S3 bandwidth cost.
  } else {
    const img = new Image();
    img.fetchPriority = eager ? 'high' : 'auto';
    img.src = url;
  }
}

function cleanupVideoPreloads(keepUrls = []) {
  const keep = new Set(keepUrls.filter(Boolean));
  for (const [url, video] of videoPreloadMap.entries()) {
    if (keep.has(url)) continue;
    video.src = '';
    videoPreloadMap.delete(url);
    preloadCache.delete(url);
  }
}

// Global cache for loaded videos to prevent re-shimmering
const loadedVideos = new Set();

function getRetryableVideoUrl(url) {
  if (!url) return null;
  try {
    const encoded = encodeURI(url);
    return encoded !== url ? encoded : null;
  } catch {
    return null;
  }
}

function addCacheBust(url) {
  if (!url) return null;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${Date.now()}`;
}

// ─── StoryVideo ──────────────────────────────────────────────────────────────
const StoryVideo = memo(function StoryVideo({ src, muted, active, paused, onEnded, onProgress }) {
  const ref = useRef(null);
  const [playbackSrc, setPlaybackSrc] = useState(src);
  const [videoReady, setVideoReady] = useState(false);
  const [isWaiting, setIsWaiting]   = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [didRetryUrl, setDidRetryUrl] = useState(false);
  const [didRetryCacheBust, setDidRetryCacheBust] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const waitTimeoutRef = useRef(null);

  useEffect(() => {
    setPlaybackSrc(src);
    setDidRetryUrl(false);
    setDidRetryCacheBust(false);
    setReloadToken(0);
    setVideoReady(false);
    setIsWaiting(false);
    setHasStarted(false);
  }, [src]);

  const attemptPlay = useCallback(() => {
    const v = ref.current;
    if (!v || !active || paused) return;
    const play = v.play();
    if (play?.catch) {
      play.catch(err => {
        console.warn('[Video] Playback blocked or failed:', err.message);
        setIsWaiting(true);
      });
    }
  }, [active, paused]);

  // Play / pause
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !paused) {
      setIsWaiting(true);
      if (v.currentSrc !== playbackSrc || v.readyState < 2) v.load();
      attemptPlay();
    } else {
      v.pause();
      if (!active) {
        v.currentTime = 0;
        setHasStarted(false);
      }
    }
  }, [active, paused, playbackSrc, reloadToken, attemptPlay]);

  useEffect(() => {
    if (!active || paused || !isWaiting) {
      if (waitTimeoutRef.current) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
      return;
    }
    waitTimeoutRef.current = setTimeout(() => {
      console.warn('[Video] Wait timeout reached, reloading story video:', src);
      const v = ref.current;
      if (!didRetryCacheBust) {
        setDidRetryCacheBust(true);
        setPlaybackSrc(addCacheBust(playbackSrc || src));
      } else {
        v?.load();
        setReloadToken(t => t + 1);
      }
    }, VIDEO_WAIT_TIMEOUT_MS);
    return () => {
      if (waitTimeoutRef.current) {
        clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = null;
      }
    };
  }, [active, paused, isWaiting, src, playbackSrc, didRetryCacheBust]);

  // Mute
  useEffect(() => {
    const v = ref.current;
    if (v) v.muted = muted;
  }, [muted]);

  const handleReady = useCallback(() => {
    if (src) loadedVideos.add(src);
    if (playbackSrc) loadedVideos.add(playbackSrc);
    setVideoReady(true);
    setIsWaiting(false);
    attemptPlay();
  }, [src, playbackSrc, attemptPlay]);

  const handleError = useCallback((e) => {
    const mediaErrorCode = e?.currentTarget?.error?.code;
    const retryUrl = getRetryableVideoUrl(playbackSrc);
    if (!didRetryUrl && retryUrl) {
      setDidRetryUrl(true);
      setPlaybackSrc(retryUrl);
      setVideoReady(false);
      setIsWaiting(true);
      console.warn('[Video] Initial load failed. Retrying with encoded URL.');
      return;
    }
    if (!didRetryCacheBust) {
      setDidRetryCacheBust(true);
      setPlaybackSrc(addCacheBust(playbackSrc || src));
      setVideoReady(false);
      setIsWaiting(true);
      console.warn('[Video] Encoded retry failed. Retrying with cache-busted URL.');
      return;
    }
    console.warn('[Video] Media load failed after retries, skipping story:', {
      url: playbackSrc || src,
      mediaErrorCode,
    });
    onEnded();
  }, [src, playbackSrc, didRetryUrl, didRetryCacheBust, onEnded]);

  return (
    <div className="absolute inset-0 bg-black">
      {/* Poster / Loading Layer */}
      <div className={`absolute inset-0 z-10 transition-opacity duration-300 ${videoReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="w-full h-full bg-black flex items-center justify-center">
          <Loader2 className="size-10 text-white/20 animate-spin" />
        </div>
      </div>

      {/* Buffering Indicator (During playback) */}
      {active && isWaiting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <Loader2 className="size-10 text-[var(--accent)] animate-spin" />
        </div>
      )}

      {/* Video */}
      <video
        ref={ref}
        src={playbackSrc}
        playsInline
        webkit-playsinline="true"
        muted={muted}
        autoPlay={active && !paused}
        preload={active ? 'auto' : 'metadata'}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
        onCanPlay={handleReady}
        onPlaying={handleReady}
        onPlay={() => {
          setIsWaiting(false);
          setHasStarted(true);
        }}
        onSeeking={() => setIsWaiting(true)}
        onSeeked={() => setIsWaiting(false)}
        onStalled={() => setIsWaiting(true)}
        onWaiting={() => setIsWaiting(true)}
        onLoadedData={handleReady}
        onLoadedMetadata={() => {
          if (active) {
            handleReady();
            attemptPlay();
          }
        }}
        onError={handleError}
        onEnded={onEnded}
        onTimeUpdate={(e) => {
          if (!hasStarted || paused || isWaiting) return;
          onProgress(e);
        }}
      />
    </div>
  );
});

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar = forwardRef(function ProgressBar(
  { count, current, paused, isReplying, isVideo, onEnd },
  activeBarRef
) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const elapsed  = useRef(0);
  const localBarRef = useRef(null);

  const setBarRef = useCallback((el) => {
    localBarRef.current = el;
    if (activeBarRef) activeBarRef.current = el;
  }, [activeBarRef]);

  const stop = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    if (localBarRef.current && startRef.current) {
      elapsed.current = Date.now() - startRef.current;
    }
  }, []);

  const run = useCallback(() => {
    startRef.current = Date.now() - elapsed.current;
    const tick = () => {
      if (!localBarRef.current) return;
      const pct = Math.min(((Date.now() - startRef.current) / STORY_DURATION) * 100, 100);
      localBarRef.current.style.transform = `scaleX(${pct / 100})`;
      if (pct < 100) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        elapsed.current = 0;
        onEnd();
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [onEnd]);

  useEffect(() => {
    elapsed.current = 0;
    if (localBarRef.current) localBarRef.current.style.transform = 'scaleX(0)';
    if (!isVideo && !paused && !isReplying) run();
    return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current); };
  }, [current, isVideo, paused, isReplying, run]);

  useEffect(() => {
    if (isVideo) return;
    if (paused || isReplying) stop(); else run();
  }, [paused, isReplying, isVideo, run, stop]);

  return (
    <div className="flex gap-1 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/25">
          {i < current ? (
            <div className="h-full w-full bg-white rounded-full" />
          ) : i === current ? (
            <div
              ref={setBarRef}
              className="h-full w-full bg-white rounded-full origin-left"
              style={{ transform: 'scaleX(0)', willChange: 'transform' }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
});

// Helper to calculate time remaining until status expiration
const getEndingSoonInfo = (story) => {
  if (!story) return null;
  const expiresTime = story.expires_at 
    ? new Date(story.expires_at).getTime() 
    : new Date(story.createdAt).getTime() + 24 * 60 * 60 * 1000;
  const msLeft = expiresTime - Date.now();
  const hrsLeft = msLeft / (1000 * 60 * 60);
  if (hrsLeft > 0 && hrsLeft <= 12) {
    if (hrsLeft < 1) {
      const mins = Math.max(1, Math.floor(msLeft / (1000 * 60)));
      return `${mins}m left`;
    }
    return `${Math.round(hrsLeft)}h left`;
  }
  return null;
};

// ─── StatusViewer ─────────────────────────────────────────────────────────────
export default function StatusViewer({ initialStatuses, initialStoryId, onClose }) {
  const router = useRouter();

  const vendorGroups = useMemo(() => {
    const groups = [];
    const seen   = new Set();
    for (const s of initialStatuses) {
      const vId = (s.vendor_id?._id || s.vendor_id)?.toString();
      if (!seen.has(vId)) {
        seen.add(vId);
        groups.push({
          vendorId: vId,
          stories: initialStatuses
            .filter(x => (x.vendor_id?._id || x.vendor_id)?.toString() === vId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        });
      }
    }
    return groups;
  }, [initialStatuses]);

  const initialPos = useMemo(() => {
    if (!initialStoryId) return { vIdx: 0, sIdx: 0 };
    for (let vIdx = 0; vIdx < vendorGroups.length; vIdx++) {
      const sIdx = vendorGroups[vIdx].stories.findIndex(s => s._id === initialStoryId);
      if (sIdx !== -1) return { vIdx, sIdx };
    }
    return { vIdx: 0, sIdx: 0 };
  }, [vendorGroups, initialStoryId]);

  const [vendorIdx,  setVendorIdx]  = useState(initialPos.vIdx);
  const [storyIdx,   setStoryIdx]   = useState(initialPos.sIdx);
  const [paused,     setPaused]     = useState(false);
  const [liked,      setLiked]      = useState(false);
  const [muted,      setMuted]      = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aura_stories_muted');
      return stored === null ? true : stored === 'true';
    }
    return true;
  });
  const [replyText,  setReplyText]  = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const videoBarRef = useRef(null);
  const holdTimer   = useRef(null);
  const touchStart  = useRef({ x: 0, y: 0, t: 0 });
  const transitionLockRef = useRef(false);
  const transitionUnlockRef = useRef(null);

  const currentGroup = vendorGroups[vendorIdx];
  const story        = currentGroup?.stories[storyIdx];
  const totalInGroup = currentGroup?.stories.length || 1;
  const totalVendors = vendorGroups.length;
  const isVideo      = story?.type === 'video';

  // Preload adjacent with a bounded window and cleanup stale preloads.
  useEffect(() => {
    if (!initialStatuses?.length || !story?._id) return;
    const globalIdx = initialStatuses.findIndex((s) => s._id === story._id);
    if (globalIdx === -1) return;

    const keepVideoUrls = [story.content_url];
    const prev = initialStatuses[globalIdx - 1];
    if (prev) {
      preloadMedia(prev.content_url, prev.type);
      if (prev.type === 'video') keepVideoUrls.push(prev.content_url);
    }

    for (let i = globalIdx + 1; i <= globalIdx + VIDEO_PRELOAD_AHEAD; i++) {
      const nextStory = initialStatuses[i];
      if (!nextStory) break;
      const eager = i <= globalIdx + 2;
      preloadMedia(nextStory.content_url, nextStory.type, { eager });
      if (nextStory.type === 'video') keepVideoUrls.push(nextStory.content_url);
    }

    cleanupVideoPreloads(keepVideoUrls);
  }, [story?._id, story?.content_url, initialStatuses]);

  // Register view
  useEffect(() => {
    if (!story?._id) return;
    api.post(`/statuses/${story._id}/view`).catch(() => {});
  }, [story?._id]);

  const dismissKeyboard = useCallback(() => {
    if (typeof document !== 'undefined') {
      const activeEl = document.activeElement;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    dismissKeyboard();
    onClose();
  }, [onClose, dismissKeyboard]);

  const resetStoryState = useCallback(() => {
    setLiked(false);
    setReplyText('');
    setIsReplying(false);
    setPaused(false);
  }, []);

  const lockTransition = useCallback(() => {
    transitionLockRef.current = true;
    if (transitionUnlockRef.current) clearTimeout(transitionUnlockRef.current);
    transitionUnlockRef.current = setTimeout(() => {
      transitionLockRef.current = false;
      transitionUnlockRef.current = null;
    }, 140);
  }, []);

  const goNext = useCallback(() => {
    if (transitionLockRef.current) return;
    dismissKeyboard();
    lockTransition();
    if (storyIdx < totalInGroup - 1) {
      setStoryIdx(s => s + 1); resetStoryState();
    } else if (vendorIdx < totalVendors - 1) {
      setVendorIdx(v => v + 1); setStoryIdx(0); resetStoryState();
    } else {
      handleClose();
    }
  }, [storyIdx, totalInGroup, vendorIdx, totalVendors, handleClose, resetStoryState, lockTransition, dismissKeyboard]);

  const goPrev = useCallback(() => {
    if (transitionLockRef.current) return;
    dismissKeyboard();
    lockTransition();
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1); resetStoryState();
    } else if (vendorIdx > 0) {
      const prevGroup = vendorGroups[vendorIdx - 1];
      setVendorIdx(v => v - 1);
      setStoryIdx(prevGroup.stories.length - 1);
      resetStoryState();
    }
  }, [storyIdx, vendorIdx, vendorGroups, resetStoryState, lockTransition, dismissKeyboard]);

  const handleVideoProgress = useCallback((e) => {
    const { currentTime, duration } = e.target;
    if (duration && duration > 0 && videoBarRef.current) {
      const progress = Math.min(currentTime / duration, 1);
      videoBarRef.current.style.transform = `scaleX(${progress})`;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (transitionUnlockRef.current) clearTimeout(transitionUnlockRef.current);
    };
  }, []);

  const ago = (date) => {
    const s = Math.floor((new Date() - new Date(date)) / 1000);
    if (s < 60)    return 'Just now';
    if (s < 3600)  return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const handleViewProduct = useCallback(() => {
    const productId = story?.linked_product?._id || story?.linked_product;
    if (!productId) return;
    handleClose();
    router.push(`/products?id=${encodeURIComponent(productId)}`);
  }, [story, handleClose, router]);

  const handleVendorClick = useCallback((e, vendorId) => {
    e.stopPropagation();
    handleClose();
    router.push(`/stores?id=${encodeURIComponent(vendorId)}`);
  }, [handleClose, router]);

  const toggleLike = useCallback(() => {
    setLiked(l => !l);
    api.post(`/statuses/${story._id}/react`).catch(() => {});
  }, [story?._id]);

  const handleShareStory = useCallback(async (e) => {
    e.stopPropagation();
    if (!story) return;

    const vendorName = story.vendor_id?.store_name || 'Auradime';
    const storyUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/discovery?tab=status&story=${encodeURIComponent(story._id)}`
      : '';
    const shareText = story.caption || story.text_content || `View ${vendorName}'s story on Auradime`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${vendorName} story`,
          text: shareText,
          url: storyUrl,
        });
        toast.success('Story link ready to share.');
        return;
      }

      await navigator.clipboard?.writeText(storyUrl || shareText);
      toast.success('Story link copied.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try {
          await navigator.clipboard?.writeText(storyUrl || shareText);
          toast.success('Story link copied.');
        } catch {}
      }
    }
  }, [story]);

  const toggleMuted = useCallback((e) => {
    e.stopPropagation();
    setMuted(m => {
      const newMuted = !m;
      localStorage.setItem('aura_stories_muted', String(newMuted));
      return newMuted;
    });
  }, []);

  const handleSendReply = useCallback(() => {
    if (!replyText.trim()) return;
    const recipientUserId = story?.vendor_id?.user_id?._id || story?.vendor_id?.user_id;
    if (!recipientUserId) return;
    const text = replyText.trim();
    dismissKeyboard();
    setReplyText('');
    setIsReplying(false);
    api.post('/chat', {
      receiver_id: recipientUserId,
      text,
      metadata: {
        type: 'story_reply',
        storyId: story._id,
        storyType: story.type,
        storyPreview: story.type === 'text' ? story.text_content : story.content_url,
        storyCaption: story.caption || '',
        storyCategory: story.category || '',
      }
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('aura_vendor_reply', { detail: story }));
    setPaused(false);
  }, [replyText, story, dismissKeyboard]);

  const onPointerDown = useCallback((e) => {
    if (isReplying) return;
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    holdTimer.current = setTimeout(() => setPaused(true), 200);
  }, [isReplying]);

  const onPointerUp = useCallback((e) => {
    if (isReplying) return;
    clearTimeout(holdTimer.current);
    const duration = Date.now() - touchStart.current.t;
    const distY = e.clientY - touchStart.current.y;
    const distX = e.clientX - touchStart.current.x;
    if (paused) { setPaused(false); return; }
    if (distY > 100 && duration < 450 && Math.abs(distY) > Math.abs(distX)) {
      handleClose();
      return;
    }
    if (duration < 400 && Math.abs(distX) > 56 && Math.abs(distX) > Math.abs(distY) * 1.15) {
      if (distX < 0) goNext();
      else goPrev();
    }
  }, [isReplying, paused, handleClose, goNext, goPrev]);

  if (!story) return null;

  const storeName  = story.vendor_id?.store_name || 'Aura Vendor';
  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full h-full md:max-w-[420px] bg-black overflow-hidden select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => clearTimeout(holdTimer.current)}
      >
        {/* Media Layer */}
        <div className="absolute inset-0 z-10">
          {currentGroup.stories.map((s, idx) => {
            const isActive = idx === storyIdx;
            const isNeighbor = Math.abs(idx - storyIdx) <= 1;
            if (!isActive && !isNeighbor) return null;
            const isVid = s.type === 'video';
            const isImg = s.type === 'image';
            
            return (
              <div
                key={s._id}
                className={`absolute inset-0 transition-all duration-500 ease-out transform ${
                  isActive 
                    ? 'translate-x-0 opacity-100 z-10 pointer-events-auto' 
                    : idx < storyIdx
                      ? '-translate-x-full opacity-0 z-0 pointer-events-none'
                      : 'translate-x-full opacity-0 z-0 pointer-events-none'
                }`}
              >
                {isVid ? (
                  <StoryVideo
                    src={s.content_url}
                    muted={muted}
                    active={isActive}
                    paused={!isActive || paused || isReplying}
                    onEnded={goNext}
                    onProgress={isActive ? handleVideoProgress : undefined}
                  />
                ) : isImg ? (
                  <img
                    src={s.content_url}
                    alt=""
                    fetchPriority={isActive ? 'high' : 'low'}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center p-12 text-center"
                    style={{ background: 'linear-gradient(165deg,#050505 0%,#150824 100%)' }}
                  >
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[350px] rounded-full bg-[var(--accent)]/12 blur-[100px]" />
                    </div>
                    <p className="relative z-10 text-3xl  font-bold text-white leading-tight drop-shadow-2xl">
                      {s.text_content}
                    </p>
                  </div>
                )}

                {/* Floating Interactive Shopping Sticker */}
                {isActive && s.linked_product && (s.linked_product.name || typeof s.linked_product === 'object') && (
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', delay: 0.4, stiffness: 200, damping: 15 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewProduct();
                    }}
                    style={{
                      left: s.sticker_x !== undefined ? `${s.sticker_x}%` : '30%',
                      top: s.sticker_y !== undefined ? `${s.sticker_y}%` : '50%',
                    }}
                    aria-label="View linked product"
                    className="absolute z-30 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 size-14 rounded-full bg-black/55 p-1.5 backdrop-blur border border-white/25 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                  >
                    <span className="absolute -right-0.5 -top-0.5 flex size-4">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                      <span className="relative inline-flex size-4 rounded-full border border-white/30 bg-[var(--accent)]" />
                    </span>
                    {vendorLogo
                      ? <img src={vendorLogo} alt="" className="size-full rounded-full object-cover ring-1 ring-white/20" />
                      : <img src="/icon-512.png" alt="" className="size-full rounded-full object-cover ring-1 ring-white/20" />
                    }
                  </motion.button>
                )}
              </div>
            );
          })}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85 pointer-events-none z-20" />
        </div>

        {/* Progress Bars */}
        <div className={`absolute top-[max(env(safe-area-inset-top,0px),14px)] inset-x-4 z-50 pointer-events-none transition-opacity duration-200 ${(paused || isReplying) ? 'opacity-0' : 'opacity-100'}`}>
          <ProgressBar
            ref={videoBarRef}
            key={`${vendorIdx}-${storyIdx}`}
            count={totalInGroup}
            current={storyIdx}
            paused={paused}
            isReplying={isReplying}
            isVideo={isVideo}
            onEnd={goNext}
          />
        </div>

        {/* Header */}
        <div
          className={`absolute inset-x-4 z-50 flex items-center justify-between transition-all duration-200 pointer-events-none ${(paused || isReplying) ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}
          style={{ top: 'calc(max(env(safe-area-inset-top, 0px), 14px) + 14px)' }}
        >
          <div 
            onClick={(e) => {
              const vId = story.vendor_id?._id || story.vendor_id;
              if (vId) handleVendorClick(e, vId);
            }}
            className="flex items-center gap-3 pointer-events-auto cursor-pointer group"
          >
            <div className="size-11 rounded-full p-[2px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-lg shrink-0 transition-transform group-hover:scale-105">
              <div className="size-full rounded-full overflow-hidden border-2 border-black bg-black">
                {vendorLogo
                  ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                  : <div className="size-full flex items-center justify-center text-xs  font-bold text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
                }
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[14px]  font-bold text-white tracking-tight drop-shadow group-hover:underline">{storeName}</p>
                <span className="text-[10px] lg:text-[12px] text-white/50  font-semibold">{ago(story.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)]">{story.category || 'Moment'}</span>
                {(() => {
                  const endingSoon = getEndingSoonInfo(story);
                  if (!endingSoon) return null;
                  return (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/25 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                      <Clock className="size-3" />
                      <span>{endingSoon}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {paused && (
              <div className="size-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Pause className="size-4 text-white" />
              </div>
            )}
            {isVideo && (
              <button
                onClick={toggleMuted}
                className="size-9 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleClose(); }}
              className="size-9 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Tap zones */}
        <div className="absolute inset-0 z-40 flex pointer-events-none">
          <div className="w-[35%] h-full pointer-events-auto" onClick={e => { e.stopPropagation(); goPrev(); }} />
          <div className="flex-1 h-full pointer-events-auto" onClick={e => { e.stopPropagation(); goNext(); }} />
        </div>

        {/* Bottom Stack */}
        <div
          className={`absolute bottom-0 inset-x-0 z-50 px-5 pb-[calc(max(env(safe-area-inset-bottom,0px),16px)+12px)] pt-20 transition-all duration-300 pointer-events-none flex flex-col justify-end
            ${isReplying ? 'translate-y-[-10px] opacity-100' : (paused ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0')}`}
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)' }}
        >
          <div className="flex flex-col gap-4 pointer-events-none">
            {/* Linked Product */}
            {story.linked_product && (story.linked_product.name || typeof story.linked_product === 'object') && (
              <div className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                <button
                  onClick={handleViewProduct}
                  className="w-full px-3 py-2.5 rounded-[1.2rem] bg-white/10 backdrop-blur-3xl border border-white/15 flex items-center justify-between active:scale-[0.98] transition-all shadow-xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-10 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0">
                      {(() => {
                        const p = story.linked_product;
                        const imgSrc = typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url || null;
                        return imgSrc
                          ? <img src={imgSrc} alt="" className="size-full object-cover" />
                          : <div className="size-full flex items-center justify-center bg-white/5"><ShoppingBag className="size-4 text-white/20" /></div>;
                      })()}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-[12px]  font-semibold text-white truncate leading-tight tracking-tight">
                        {story.linked_product.name || 'View Product'}
                      </p>
                      {story.linked_product.price && (
                        <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] mt-0.5">
                          {story.linked_product.price?.toLocaleString()} XAF
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="size-8 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg ml-2 active:scale-90 transition-transform">
                    <ShoppingBag className="size-4" />
                  </div>
                </button>
              </div>
            )}

            {/* Caption */}
            {story.caption && (
              <div className="pointer-events-auto px-1 py-1">
                <p className="text-[14px] md:text-[15px] text-white/95 font-medium leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-4">
                  {story.caption}
                </p>
              </div>
            )}

            {/* Reply row */}
            <div className="flex items-center gap-2.5 pointer-events-auto mt-1">
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onFocus={() => { setIsReplying(true); setPaused(true); }}
                  onBlur={() => { setIsReplying(false); setPaused(false); }}
                  onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Reply..."
                  className="w-full h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-5 pr-12 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--accent)]/60 focus:bg-white/15 transition-all shadow-inner"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className={`absolute right-1.5 size-9 rounded-full flex items-center justify-center transition-all ${replyText.trim() ? 'bg-[var(--accent)] text-white shadow-lg' : 'bg-white/5 text-white/20'}`}
                >
                  <Send className="size-4" />
                </button>
              </div>

              <button
                onClick={e => { e.stopPropagation(); toggleLike(); }}
                className={`size-12 rounded-full flex items-center justify-center border transition-all shadow-lg ${liked ? 'bg-red-500 border-red-500 scale-110' : 'bg-white/10 border-white/15 backdrop-blur-xl'}`}
              >
                <Heart className={`size-5 text-white ${liked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleShareStory}
                className="size-12 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white shadow-lg"
              >
                <Share2 className="size-5" />
              </button>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between px-1 opacity-40 pt-2">
              <div className="flex items-center gap-1.5 text-white">
                <Eye className="size-3" />
                <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-tighter">{story.views_count || 0}</span>
              </div>
              <span className="text-[11px] lg:text-[12px]  font-semibold text-white  tracking-tighter">
                {storyIdx + 1} / {totalInGroup}
                {totalVendors > 1 && <span className="opacity-50"> · V {vendorIdx + 1}/{totalVendors}</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
