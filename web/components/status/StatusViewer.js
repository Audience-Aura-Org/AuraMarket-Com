"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Heart, ShoppingBag, MessageCircle,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Eye, Flame
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';

const STORY_DURATION = 5000; // ms for image/text
const TICK = 50; // ms per progress tick

/**
 * StatusViewer
 * Full-screen cinematic story viewer.
 * - Preloads adjacent images for instant transitions
 * - Swipe & keyboard navigation
 * - Tap-left / tap-right zones  (WhatsApp style)
 * - Hold-to-pause
 */
export default function StatusViewer({ initialStatuses, onClose }) {
  const router = useRouter();
  const { openChat } = useChat();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [direction, setDirection] = useState(1); // 1=forward, -1=backward

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  const current = initialStatuses[currentIndex];
  const total = initialStatuses.length;
  const isVideo = current?.type === 'video';
  const duration = isVideo ? (videoRef.current?.duration * 1000 || 30000) : STORY_DURATION;

  // ── Preload next image ──────────────────────────────────────
  useEffect(() => {
    const next = initialStatuses[currentIndex + 1];
    if (next?.content_url && next.type === 'image') {
      const img = new Image();
      img.src = next.content_url;
    }
  }, [currentIndex, initialStatuses]);

  // ── Track view ──────────────────────────────────────────────
  useEffect(() => {
    if (current) {
      api.post(`/statuses/${current._id}/view`).catch(() => {});
      setIsLiked(current.isLiked || false);
      setProgress(0);
    }
  }, [currentIndex]);

  // ── Progress timer ──────────────────────────────────────────
  useEffect(() => {
    if (isPaused || isVideo) return;
    const step = (TICK / duration) * 100;
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearInterval(timerRef.current);
          return 100;
        }
        return p + step;
      });
    }, TICK);
    return () => clearInterval(timerRef.current);
  }, [currentIndex, isPaused, isVideo, duration]);

  // ── Auto-advance when progress reaches 100 ──────────────────
  useEffect(() => {
    if (progress >= 100) goNext();
  }, [progress]);

  // ── Keyboard navigation ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, total]);

  const goNext = useCallback(() => {
    setDirection(1);
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, total, onClose]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // ── Touch swipe ─────────────────────────────────────────────
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev();
    }
    touchStartX.current = null;
  };

  const toggleLike = async () => {
    setIsLiked(l => !l);
    try { await api.post(`/statuses/${current._id}/react`); } catch {}
  };

  const handleChat = () => {
    const vName = current.vendor_id?.store_name || 'Vendor';
    openChat(current.vendor_id?.user_id?._id, current.linked_product, {
      store_name: vName,
      initialMessage: `Hi, I saw this on your story 👇`
    });
    onClose();
  };

  const handleViewProduct = () => {
    const pid = current.linked_product?._id || current.linked_product;
    if (pid) router.push(`/products/${pid}`);
  };

  if (!current) return null;

  const vendorLogo = current.vendor_id?.user_id?.branding?.logo || current.vendor_id?.user_id?.avatar;
  const storeName = current.vendor_id?.store_name || '';

  // Slide variants
  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60, scale: 0.97 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60, scale: 0.97 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Outer dim background ── */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* ── Story card ── */}
      <div className="relative w-full h-full max-w-[420px] mx-auto flex flex-col overflow-hidden select-none">

        {/* Progress bars */}
        <div className="absolute top-3 inset-x-3 z-50 flex gap-1">
          {initialStatuses.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/25">
              <motion.div
                className="h-full bg-white rounded-full"
                style={{
                  width: `${i < currentIndex ? 100 : i === currentIndex ? progress : 0}%`,
                  transition: i === currentIndex ? `width ${TICK}ms linear` : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 inset-x-4 z-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full overflow-hidden border-2 border-white/30 shadow-md bg-black/40">
              {vendorLogo
                ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                : <div className="size-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
              }
            </div>
            <div>
              <p className="text-[13px] font-black text-white leading-tight tracking-tight drop-shadow">{storeName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Aura Verified</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute for video */}
            {isVideo && (
              <button
                onClick={() => {
                  setMuted(m => !m);
                  if (videoRef.current) videoRef.current.muted = !muted;
                }}
                className="size-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all"
              >
                {muted ? <VolumeX className="size-4 text-white" /> : <Volume2 className="size-4 text-white" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="size-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all"
            >
              <X className="size-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0 z-10"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            {current.type === 'video' ? (
              <video
                ref={videoRef}
                src={current.content_url}
                autoPlay
                playsInline
                muted={muted}
                className="w-full h-full object-cover"
                onEnded={goNext}
                onTimeUpdate={(e) => {
                  const ratio = (e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100;
                  setProgress(ratio);
                }}
              />
            ) : current.type === 'image' ? (
              <img
                src={current.content_url}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              // Text status — premium glassmorphism gradient card
              <div
                className="w-full h-full flex items-center justify-center p-10 text-center"
                style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }}
              >
                {/* Ambient glow */}
                <div className="absolute inset-0 opacity-40">
                  <div className="absolute top-1/3 left-1/2 -translate-x-1/2 size-64 rounded-full bg-[var(--accent)] blur-[100px]" />
                </div>
                <p className="relative z-10 text-3xl font-black italic text-white leading-snug tracking-tight"
                   style={{ textShadow: '0 0 40px rgba(var(--accent-rgb), 0.5)' }}>
                  {current.text_content}
                </p>
              </div>
            )}

            {/* Dark gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* ── Tap navigation zones (on top of content, below controls) ── */}
        <div className="absolute inset-x-0 top-20 bottom-32 z-30 flex pointer-events-auto">
          <div className="flex-1 cursor-pointer" onClick={goPrev} />
          <div className="w-8" /> {/* center dead zone */}
          <div className="flex-1 cursor-pointer" onClick={goNext} />
        </div>

        {/* ── Footer ── */}
        <div className="absolute bottom-0 inset-x-0 z-40 px-5 pb-10 pt-24 bg-gradient-to-t from-black via-black/70 to-transparent">

          {/* Caption */}
          {current.caption && (
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-sm text-white/90 font-medium mb-5 leading-relaxed line-clamp-3 bg-white/5 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/10"
            >
              {current.caption}
            </motion.p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            {/* Like */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={toggleLike}
              className={`flex items-center justify-center gap-2 h-12 px-5 rounded-2xl border font-black text-[11px] uppercase tracking-widest transition-all duration-200 ${
                isLiked
                  ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              <Heart className={`size-4 transition-transform ${isLiked ? 'fill-current scale-110' : ''}`} />
              <span>{isLiked ? 'Liked' : 'Like'}</span>
            </motion.button>

            {/* View Product */}
            {current.linked_product && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleViewProduct}
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-purple-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[var(--accent)]/30 active:opacity-90 transition-all"
              >
                <ShoppingBag className="size-4" />
                <span>View Product</span>
              </motion.button>
            )}

            {/* Chat */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleChat}
              className={`flex items-center justify-center gap-2 h-12 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/20 backdrop-blur-sm font-black text-[11px] uppercase tracking-widest transition-all ${
                current.linked_product ? 'px-3.5' : 'flex-1'
              }`}
            >
              <MessageCircle className="size-4" />
              {!current.linked_product && <span>Chat</span>}
            </motion.button>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between mt-4 px-1">
            <div className="flex items-center gap-2 text-white/40">
              <Eye className="size-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-widest">{current.views_count || 0} views</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="size-3.5 text-orange-400" />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                {currentIndex + 1} / {total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop chevron controls ── */}
      <button
        onClick={goPrev}
        className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50 disabled:opacity-30"
        disabled={currentIndex === 0}
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        onClick={goNext}
        className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 size-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-white/10 transition-all z-50"
      >
        <ChevronRight className="size-6" />
      </button>
    </motion.div>
  );
}
