"use client";
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  X, Heart, ShoppingBag, MessageCircle,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Eye, Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';

const STORY_DURATION = 5000;

/**
 * StatusViewer — WhatsApp-speed story viewer.
 * - Progress bar keyed directly on idx (resets in the SAME render, no useEffect delay)
 * - Navigation never blocked by loading state
 * - Preloads ±2 adjacent images ahead of time
 * - Adjacent stories rendered off-screen (opacity-0) for instant swap
 * - Zero unnecessary re-renders: all navigation is synchronous setIdx
 */

// Preload helper — fire and forget
function preloadImage(url) {
  if (!url || typeof window === 'undefined') return;
  const img = new Image();
  img.src = url;
}

// Single story content — memoized so only re-mounts when idx changes
const StoryContent = memo(function StoryContent({ story, muted, videoRef, onVideoEnd }) {
  if (!story) return null;

  if (story.type === 'video') {
    return (
      <video
        ref={videoRef}
        src={story.content_url}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
        onEnded={onVideoEnd}
        preload="auto"
      />
    );
  }

  if (story.type === 'image') {
    return (
      // BlurUpImage: blurred placeholder shows instantly, sharp fades in.
      // Same URL = one network request, shared browser cache.
      <BlurUpImage
        src={story.content_url}
        alt=""
        priority="high"
        className="w-full h-full"
        objectFit="cover"
      />
    );
  }

  // Text story
  return (
    <div
      className="w-full h-full flex items-center justify-center p-10 text-center"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }}
    >
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 size-64 rounded-full bg-[var(--accent)] blur-[100px]" />
      </div>
      <p className="relative z-10 text-3xl font-black italic text-white leading-snug tracking-tight">
        {story.text_content}
      </p>
    </div>
  );
});

export default function StatusViewer({ initialStatuses, onClose }) {
  const router = useRouter();
  const { openChat } = useChat();

  const [idx, setIdx] = useState(0);
  // Paused & liked are the only state we need — no imgReady, no progressKey
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);

  const videoRef = useRef(null);
  const holdTimer = useRef(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });

  const story = initialStatuses[idx];
  const total = initialStatuses.length;
  const isVideo = story?.type === 'video';

  // ── Preload ALL images on mount (aggressive) ──────────────────
  useEffect(() => {
    initialStatuses.forEach(s => {
      if ((s.type === 'image') && s.content_url) preloadImage(s.content_url);
    });
  }, []); // eslint-disable-line

  // ── Lock body scroll ──────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Side-effect on idx change (fire-and-forget, no state updates) ──
  useEffect(() => {
    if (!story) return;
    // Fire-and-forget view tracking
    api.post(`/statuses/${story._id}/view`).catch(() => {});
    // Preload adjacent images right away
    const next = initialStatuses[idx + 1];
    const prev = initialStatuses[idx - 1];
    if (next?.content_url) preloadImage(next.content_url);
    if (prev?.content_url) preloadImage(prev.content_url);
    // Sync liked state (no re-render cascade: setLiked is a single state update)
    setLiked(story.isLiked || false);
  }, [idx]); // eslint-disable-line

  // ── Navigation (synchronous — never blocked) ──────────────────
  const goNext = useCallback(() => {
    setIdx(i => {
      if (i < total - 1) return i + 1;
      onClose();
      return i;
    });
  }, [total, onClose]);

  const goPrev = useCallback(() => {
    setIdx(i => Math.max(0, i - 1));
  }, []);

  // ── Progress bar end (CSS animation driven) ───────────────────
  // We use idx as the key on the animated bar so React resets the
  // animation in the SAME render cycle — no useEffect delay.
  const handleProgressEnd = useCallback(() => {
    if (!paused) goNext();
  }, [paused, goNext]);

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  // ── Touch: long-press = pause, horizontal swipe = navigate ───
  const onTouchStart = useCallback((e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now()
    };
    holdTimer.current = setTimeout(() => setPaused(true), 200);
  }, []);

  const onTouchEnd = useCallback((e) => {
    clearTimeout(holdTimer.current);
    if (paused) { setPaused(false); return; }

    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;

    if (dy < -80) { onClose(); return; }
    if (dy > 80 && !story?.linked_product) { handleChat(); return; }

    if (Math.abs(dx) > 40) {
      // Lower threshold (40px vs 60px) = more responsive swipe
      dx > 0 ? goNext() : goPrev();
    }
  }, [paused, story, goNext, goPrev, onClose]); // eslint-disable-line

  // ── Actions ───────────────────────────────────────────────────
  const toggleLike = useCallback(async () => {
    setLiked(l => !l);
    try { await api.post(`/statuses/${story._id}/react`); } catch {}
  }, [story]);

  const handleChat = useCallback(() => {
    const vName = story.vendor_id?.store_name || 'Vendor';
    openChat(story.vendor_id?.user_id?._id, story.linked_product, {
      store_name: vName,
      initialMessage: `Hi, I saw this on your story 👇`
    });
    onClose();
  }, [story, openChat, onClose]);

  const handleViewProduct = useCallback(() => {
    const pid = story.linked_product?._id || story.linked_product;
    if (pid) router.push(`/products/${pid}`);
  }, [story, router]);

  if (!story) return null;

  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;
  const storeName = story.vendor_id?.store_name || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* Background dismiss */}
      <div className="absolute inset-0 bg-black/95" onClick={onClose} />

      {/* Story container */}
      <div
        className="relative w-full h-full max-w-[420px] mx-auto flex flex-col overflow-hidden select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Progress bars ─────────────────────────────────────
            Key strategy: each segment gets a stable key based on index.
            The ACTIVE segment's inner fill is keyed on `idx` itself,
            so React destroys & recreates it in the same render → instant reset.
        ──────────────────────────────────────────────────────── */}
        <div className={`absolute top-3 inset-x-3 z-50 flex gap-1 transition-opacity duration-150 ${paused ? 'opacity-0' : 'opacity-100'}`}>
          {initialStatuses.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/25">
              {i < idx ? (
                // Completed — always full, stable key
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === idx ? (
                // Active — keyed on idx so it remounts (and restarts animation) instantly
                <div
                  key={`active-${idx}`}
                  className="h-full rounded-full bg-white"
                  style={{
                    width: paused ? undefined : '100%',
                    animation: paused
                      ? 'none'
                      : `story-progress ${isVideo ? '30s' : `${STORY_DURATION}ms`} linear forwards`,
                  }}
                  onAnimationEnd={handleProgressEnd}
                />
              ) : (
                // Future — empty
                <div className="h-full w-0" />
              )}
            </div>
          ))}
        </div>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className={`absolute top-8 inset-x-4 z-50 flex items-center justify-between transition-opacity duration-150 ${paused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full overflow-hidden border-2 border-white/30 shadow-md bg-black/40">
              {vendorLogo
                ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                : <div className="size-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
              }
            </div>
            <div>
              <p className="text-[13px] font-black text-white leading-tight tracking-tight drop-shadow">{storeName}</p>
              <span className="text-[9px] font-bold text-white/50">
                {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVideo && (
              <button
                onClick={() => {
                  setMuted(m => !m);
                  if (videoRef.current) videoRef.current.muted = !muted;
                }}
                className="size-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
              >
                {muted ? <VolumeX className="size-4 text-white" /> : <Volume2 className="size-4 text-white" />}
              </button>
            )}
            <button onClick={onClose} className="size-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <X className="size-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Story Content (instant swap via key) ─────────────
            key={idx} forces React to unmount old & mount new content
            in the SAME commit — no transition delay, no waiting.
            The background color is a dark fallback so there's no white flash.
        ──────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 z-10 bg-zinc-900"
        >
          <StoryContent
            story={story}
            muted={muted}
            videoRef={videoRef}
            onVideoEnd={goNext}
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        </div>

        {/* ── Tap zones (wide, no dead gap) ────────────────────
            Split 35%/65% — left third goes back, right two-thirds go forward
            matching Instagram/WhatsApp muscle memory.
        ──────────────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 top-20 bottom-32 z-30 flex pointer-events-auto">
          <div className="w-[35%]" onClick={goPrev} />
          <div className="flex-1" onClick={goNext} />
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className={`absolute bottom-0 inset-x-0 z-40 px-5 pb-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-200 ${paused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {story.caption && (
            <p className="text-sm text-white/90 font-medium mb-4 leading-relaxed line-clamp-3 bg-white/5 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10">
              {story.caption}
            </p>
          )}

          <div className="flex items-center gap-2.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
              className={`flex items-center justify-center gap-2 h-11 px-5 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-colors ${
                liked
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-white/10 border-white/15 text-white'
              }`}
            >
              <Heart className={`size-3.5 ${liked ? 'fill-current' : ''}`} />
              {liked ? 'Liked' : 'Like'}
            </motion.button>

            {story.linked_product && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleViewProduct}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-purple-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg"
              >
                <ShoppingBag className="size-3.5" />
                View Product
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleChat}
              className={`flex items-center justify-center gap-2 h-11 rounded-2xl bg-white/10 border border-white/15 text-white font-black text-[10px] uppercase tracking-widest ${
                story.linked_product ? 'px-3.5' : 'flex-1'
              }`}
            >
              <MessageCircle className="size-3.5" />
              {!story.linked_product && 'Chat'}
            </motion.button>
          </div>

          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-1.5 text-white/35">
              <Eye className="size-3" />
              <span className="text-[8px] font-bold uppercase tracking-widest">{story.views_count || 0} views</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="size-3 text-orange-400" />
              <span className="text-[8px] font-bold text-white/35 uppercase tracking-widest">{idx + 1}/{total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop nav arrows */}
      <button
        onClick={goPrev}
        disabled={idx === 0}
        className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50 disabled:opacity-20"
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        onClick={goNext}
        className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50"
      >
        <ChevronRight className="size-6" />
      </button>

      {/* CSS keyframe for story progress bar */}
      <style>{`
        @keyframes story-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </motion.div>
  );
}
