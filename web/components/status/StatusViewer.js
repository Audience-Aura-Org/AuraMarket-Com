"use client";
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
 * - Buffer Stack: Renders adjacent stories in the DOM (opacity-0) so they load in background
 * - Zero "dark screens": The next story is already rendered before you tap.
 */

// Single story content — renders immediately, manages its own playback
const StoryContent = memo(function StoryContent({ story, active, muted, onVideoEnd }) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (story.type === 'video' && localVideoRef.current) {
      if (active) {
        localVideoRef.current.currentTime = 0;
        localVideoRef.current.play().catch(() => {});
      } else {
        localVideoRef.current.pause();
      }
    }
  }, [active, story.type]);

  if (!story) return null;

  if (story.type === 'video') {
    return (
      <video
        ref={localVideoRef}
        src={story.content_url}
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
      <BlurUpImage
        src={story.content_url}
        alt=""
        priority={active ? "high" : "low"}
        className="w-full h-full"
        objectFit="cover"
      />
    );
  }

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
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);

  const holdTimer = useRef(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });

  const story = initialStatuses[idx];
  const total = initialStatuses.length;
  const isVideo = story?.type === 'video';

  // ── Preload Strategy ──────────────────────────────────────────
  useEffect(() => {
    // Background preload of all story media once component mounts
    initialStatuses.forEach(s => {
      if (s.type === 'image' && s.content_url) {
        const img = new Image();
        img.src = s.content_url;
      }
    });
  }, [initialStatuses]);

  const goNext = useCallback(() => {
    if (idx < total - 1) {
      setIdx(idx + 1);
      setLiked(false);
    } else {
      onClose();
    }
  }, [idx, total, onClose]);

  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(idx - 1);
      setLiked(false);
    }
  }, [idx]);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    try {
      await api.post(`/statuses/${story._id}/like`);
    } catch (e) { console.error(e); }
  };

  const handleViewProduct = () => {
    if (!story.linked_product?._id) return;
    onClose();
    router.push(`/products/${story.linked_product._id}`);
  };

  const handleChat = () => {
    const vId = story.vendor_id?._id || story.vendor_id;
    if (!vId) return;
    onClose();
    router.push(`/messages?vendorId=${vId}`);
  };

  const handleProgressEnd = () => {
    if (!paused) goNext();
  };

  // ── Interaction Handlers ─────────────────────────────────────
  const onPointerDown = (e) => {
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    holdTimer.current = setTimeout(() => setPaused(true), 250);
  };

  const onPointerUp = (e) => {
    clearTimeout(holdTimer.current);
    const duration = Date.now() - touchStart.current.t;
    const dist = Math.abs(e.clientX - touchStart.current.x);

    if (paused) {
      setPaused(false);
      return;
    }

    // Swipe down to close
    if (e.clientY - touchStart.current.y > 100 && duration < 500) {
      onClose();
      return;
    }

    if (duration < 250 && dist < 10) {
      const width = window.innerWidth;
      if (e.clientX < width * 0.35) goPrev();
      else goNext();
    }
  };

  if (!story) return null;

  const storeName = story.vendor_id?.store_name || "Aura Vendor";
  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center select-none touch-none overflow-hidden"
    >
      <div
        className="relative w-full h-full max-w-md mx-auto bg-zinc-900 overflow-hidden shadow-2xl"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* ── Progress Indicators ─────────────────────────────── */}
        <div className={`absolute top-3 inset-x-3 z-50 flex gap-1 transition-opacity duration-150 ${paused ? 'opacity-0' : 'opacity-100'}`}>
          {initialStatuses.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/25">
              {i < idx ? (
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === idx ? (
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
                onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                className="size-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
              >
                {muted ? <VolumeX className="size-4 text-white" /> : <Volume2 className="size-4 text-white" />}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="size-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <X className="size-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── BUFFER STACK (The "WhatsApp" Secret) ──────────────
            We render a window of stories.
            Active story is opacity-100.
            Next/Prev stories are in the DOM (loading pixels) but opacity-0.
            This guarantees zero "dark screens" or "load stops".
        ──────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 z-10 bg-black">
          {initialStatuses.map((s, i) => {
            // Only render current, next, and previous to save memory
            const isNear = Math.abs(i - idx) <= 1;
            if (!isNear) return null;

            return (
              <div
                key={s._id}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  i === idx ? 'opacity-100 z-20' : 'opacity-0 z-10'
                }`}
              >
                <StoryContent
                  story={s}
                  active={i === idx}
                  muted={muted}
                  onVideoEnd={goNext}
                />
              </div>
            );
          })}
          {/* Global gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-30" />
        </div>

        {/* ── Tap zones ── */}
        <div className="absolute inset-x-0 top-20 bottom-32 z-40 flex pointer-events-auto">
          <div className="w-[35%]" onClick={(e) => { e.stopPropagation(); goPrev(); }} />
          <div className="flex-1" onClick={(e) => { e.stopPropagation(); goNext(); }} />
        </div>

        {/* ── Footer ── */}
        <div className={`absolute bottom-0 inset-x-0 z-50 px-5 pb-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-200 ${paused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {story.caption && (
            <p className="text-sm text-white/90 font-medium mb-4 leading-relaxed line-clamp-3 bg-white/5 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10">
              {story.caption}
            </p>
          )}

          <div className="flex items-center gap-2.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); toggleLike(); }}
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
                onClick={(e) => { e.stopPropagation(); handleViewProduct(); }}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-purple-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg"
              >
                <ShoppingBag className="size-3.5" />
                View Product
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); handleChat(); }}
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
        className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-[1001] disabled:opacity-20"
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        onClick={goNext}
        className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-[1001]"
      >
        <ChevronRight className="size-6" />
      </button>

      <style jsx global>{`
        @keyframes story-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </motion.div>
  );
}
