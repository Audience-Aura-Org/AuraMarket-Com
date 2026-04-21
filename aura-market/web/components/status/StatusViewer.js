"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Heart, ShoppingBag, MessageCircle,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Eye, Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';

const STORY_DURATION = 5000;

/**
 * StatusViewer — Ultra-fast fullscreen story viewer.
 * - Preloads ALL images on mount for zero lag
 * - Pure CSS progress bar (no JS interval)
 * - Simple tap-left/right navigation
 * - Swipe with dead-zone to prevent conflict
 * - Long-press to pause
 */
export default function StatusViewer({ initialStatuses, onClose }) {
  const router = useRouter();
  const { openChat } = useChat();

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  const videoRef = useRef(null);
  const holdTimer = useRef(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const progressKey = useRef(0);

  const story = initialStatuses[idx];
  const total = initialStatuses.length;
  const isVideo = story?.type === 'video';

  // ── Preload ALL images at mount ────────────────────────────
  useEffect(() => {
    initialStatuses.forEach(s => {
      if (s.type === 'image' && s.content_url) {
        const img = new Image();
        img.src = s.content_url;
      }
    });
  }, []);

  // ── Lock body scroll ───────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Track view (fire-and-forget) ───────────────────────────
  useEffect(() => {
    if (story) {
      api.post(`/statuses/${story._id}/view`).catch(() => {});
      setLiked(story.isLiked || false);
      setImgReady(false);
      progressKey.current++;
    }
  }, [idx]);

  // ── Auto-advance (CSS animation end) ──────────────────────
  const handleProgressEnd = useCallback(() => {
    if (!paused) goNext();
  }, [idx, total, paused]);

  // ── Navigation ─────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (idx < total - 1) setIdx(i => i + 1);
    else onClose();
  }, [idx, total, onClose]);

  const goPrev = useCallback(() => {
    if (idx > 0) setIdx(i => i - 1);
  }, [idx]);

  // ── Keyboard ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  // ── Touch: swipe (>60px) vs hold-to-pause (>200ms) ────────
  const onTouchStart = (e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now()
    };
    holdTimer.current = setTimeout(() => setPaused(true), 200);
  };

  const onTouchEnd = (e) => {
    clearTimeout(holdTimer.current);
    if (paused) { setPaused(false); return; }
    
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    
    // WhatsApp Gestures: Swipe down to close, swipe up to chat
    if (dy < -80) { onClose(); return; }
    if (dy > 80 && !story?.linked_product) { handleChat(); return; }
    
    // Original: Horizontal swipe
    if (Math.abs(dx) > 60) {
      dx > 0 ? goNext() : goPrev();
    }
  };

  // ── Actions ────────────────────────────────────────────────
  const toggleLike = async () => {
    setLiked(l => !l);
    try { await api.post(`/statuses/${story._id}/react`); } catch {}
  };

  const handleChat = () => {
    const vName = story.vendor_id?.store_name || 'Vendor';
    openChat(story.vendor_id?.user_id?._id, story.linked_product, {
      store_name: vName,
      initialMessage: `Hi, I saw this on your story 👇`
    });
    onClose();
  };

  const handleViewProduct = () => {
    const pid = story.linked_product?._id || story.linked_product;
    if (pid) router.push(`/products/${pid}`);
  };

  if (!story) return null;

  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;
  const storeName = story.vendor_id?.store_name || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
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
        {/* ── Progress bars (CSS animation driven) ── */}
        <div className={`absolute top-3 inset-x-3 z-50 flex gap-1 transition-opacity duration-200 ${paused ? 'opacity-0' : 'opacity-100'}`}>
          {initialStatuses.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/20">
              <div
                className="h-full rounded-full"
                style={{
                  width: i < idx ? '100%' : i > idx ? '0%' : undefined,
                  background: 'white',
                  ...(i === idx ? {
                    width: paused ? undefined : '100%',
                    animation: paused ? 'none' : `progress-fill ${isVideo ? '30s' : `${STORY_DURATION}ms`} linear forwards`,
                  } : {})
                }}
                onAnimationEnd={i === idx ? handleProgressEnd : undefined}
                key={i === idx ? `p-${progressKey.current}` : `done-${i}`}
              />
            </div>
          ))}
        </div>

        {/* ── Header ── */}
        <div className={`absolute top-8 inset-x-4 z-50 flex items-center justify-between transition-opacity duration-200 ${paused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full overflow-hidden border-2 border-white/30 shadow-md bg-black/40">
              {vendorLogo
                ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                : <div className="size-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
              }
            </div>
            <div>
              <p className="text-[13px] font-black text-white leading-tight tracking-tight drop-shadow">{storeName}</p>
              <span className="text-[9px] font-bold text-white/50">{new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVideo && (
              <button
                onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
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

        {/* ── Content (instant swap, no AnimatePresence) ── */}
        <div className="absolute inset-0 z-10" key={idx}>
          {story.type === 'video' ? (
            <video
              ref={videoRef}
              src={story.content_url}
              autoPlay playsInline muted={muted}
              className="w-full h-full object-cover"
              onEnded={goNext}
            />
          ) : story.type === 'image' ? (
            <img
              src={story.content_url}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
              onLoad={() => setImgReady(true)}
            />
          ) : (
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
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        </div>

        {/* ── Tap zones ── */}
        <div className="absolute inset-x-0 top-20 bottom-32 z-30 flex pointer-events-auto">
          <div className="flex-1" onClick={goPrev} />
          <div className="w-8" />
          <div className="flex-1" onClick={goNext} />
        </div>

        {/* ── Footer ── */}
        <div className={`absolute bottom-0 inset-x-0 z-40 px-5 pb-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent transition-opacity duration-300 ${paused ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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

      {/* Desktop nav */}
      <button onClick={goPrev} disabled={idx === 0}
        className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50 disabled:opacity-20"
      >
        <ChevronLeft className="size-6" />
      </button>
      <button onClick={goNext}
        className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50"
      >
        <ChevronRight className="size-6" />
      </button>

      {/* CSS animation for progress bar */}
      <style jsx global>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </motion.div>
  );
}
