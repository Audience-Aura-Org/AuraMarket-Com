"use client";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Heart, ShoppingBag,
  Volume2, VolumeX,
  Eye, Flame, Send, Sparkles,
  Share2, Tag
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';

const STORY_DURATION = 5000;

// ─── StoryContent ──────────────────────────────────────────────────────────────
const StoryContent = memo(function StoryContent({ story, active, paused, muted, onVideoEnd, onTimeUpdate }) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (story.type === 'video' && localVideoRef.current) {
      if (active) {
        if (!paused) localVideoRef.current.play().catch(() => {});
        else localVideoRef.current.pause();
      } else {
        localVideoRef.current.pause();
        localVideoRef.current.currentTime = 0;
      }
    }
  }, [active, paused, story.type]);

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
        onTimeUpdate={onTimeUpdate}
        preload="auto"
      />
    );
  }

  if (story.type === 'image') {
    return (
      <BlurUpImage
        src={story.content_url}
        alt=""
        priority="high"
        className="w-full h-full"
        objectFit="cover"
      />
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center p-12 text-center"
      style={{ background: 'linear-gradient(165deg, #050505 0%, #150824 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[400px] rounded-full bg-[var(--accent)]/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 size-[300px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>
      <p className="relative z-10 text-4xl font-black italic text-white leading-tight tracking-tighter drop-shadow-2xl">
        {story.text_content}
      </p>
    </div>
  );
});

// ─── StatusViewer ─────────────────────────────────────────────────────────────
export default function StatusViewer({ initialStatuses, onClose }) {
  const router = useRouter();
  const { openChat } = useChat();

  // ── Group by vendor so progress bars are per-vendor ──────────────────────
  const vendorGroups = useMemo(() => {
    const groups = [];
    const seen   = new Set();
    for (const s of initialStatuses) {
      const vId = (s.vendor_id?._id || s.vendor_id)?.toString();
      if (!seen.has(vId)) {
        seen.add(vId);
        groups.push({
          vendorId: vId,
          stories: initialStatuses.filter(
            x => (x.vendor_id?._id || x.vendor_id)?.toString() === vId
          )
        });
      }
    }
    return groups;
  }, [initialStatuses]);

  const [vendorIdx,   setVendorIdx]   = useState(0);
  const [storyIdx,    setStoryIdx]    = useState(0);
  const [paused,      setPaused]      = useState(false);
  const [liked,       setLiked]       = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [replyText,   setReplyText]   = useState('');
  const [isReplying,  setIsReplying]  = useState(false);

  const holdTimer  = useRef(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });

  const currentGroup  = vendorGroups[vendorIdx];
  const story         = currentGroup?.stories[storyIdx];
  const totalInGroup  = currentGroup?.stories.length || 1;
  const totalVendors  = vendorGroups.length;
  const isVideo       = story?.type === 'video';
  const progressBarId = `pb-${vendorIdx}-${storyIdx}`;

  // Preload all images upfront
  useEffect(() => {
    initialStatuses.forEach(s => {
      if (s.type === 'image' && s.content_url) new Image().src = s.content_url;
    });
  }, [initialStatuses]);

  const resetStoryState = () => {
    setLiked(false);
    setReplyText('');
    setIsReplying(false);
    setPaused(false);
  };

  const goNext = useCallback(() => {
    if (storyIdx < totalInGroup - 1) {
      setStoryIdx(s => s + 1);
      resetStoryState();
    } else if (vendorIdx < totalVendors - 1) {
      setVendorIdx(v => v + 1);
      setStoryIdx(0);
      resetStoryState();
    } else {
      onClose();
    }
  }, [storyIdx, totalInGroup, vendorIdx, totalVendors, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
      resetStoryState();
    } else if (vendorIdx > 0) {
      const prevGroup = vendorGroups[vendorIdx - 1];
      setVendorIdx(v => v - 1);
      setStoryIdx(prevGroup.stories.length - 1);
      resetStoryState();
    }
  }, [storyIdx, vendorIdx, vendorGroups]);

  const ago = (date) => {
    const s = Math.floor((new Date() - new Date(date)) / 1000);
    if (s < 60)    return 'Just now';
    if (s < 3600)  return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const handleProgressEnd = () => { if (!paused && !isReplying) goNext(); };

  const handleViewProduct = () => {
    if (!story.linked_product?._id) return;
    onClose();
    router.push(`/products/${story.linked_product._id}`);
  };

  const toggleLike = () => {
    setLiked(l => !l);
    api.post(`/statuses/${story._id}/like`).catch(() => {});
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    const recipientUserId = story.vendor_id?.user_id?._id || story.vendor_id?.user_id;
    if (!recipientUserId) return;
    const text = replyText.trim();
    setReplyText('');
    setIsReplying(false);
    api.post('/chat', {
      receiver_id: recipientUserId,
      text,
      metadata: {
        type: 'story_reply',
        storyId: story._id,
        storyPreview: story.type === 'text' ? story.text_content : story.content_url
      }
    }).catch(e => console.error('Story reply failed:', e));
  };

  const onPointerDown = (e) => {
    if (isReplying) return;
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    holdTimer.current = setTimeout(() => setPaused(true), 250);
  };

  const onPointerUp = (e) => {
    if (isReplying) return;
    clearTimeout(holdTimer.current);
    const duration = Date.now() - touchStart.current.t;
    const distX    = Math.abs(e.clientX - touchStart.current.x);
    const distY    = e.clientY - touchStart.current.y;

    if (paused) { setPaused(false); return; }
    if (distY > 100 && duration < 500) { onClose(); return; }
    if (duration < 250 && distX < 10) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width * 0.35) goPrev();
      else goNext();
    }
  };

  if (!story) return null;

  const storeName  = story.vendor_id?.store_name || 'Aura Vendor';
  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;
  const nextStory  = storyIdx < totalInGroup - 1
    ? currentGroup.stories[storyIdx + 1]
    : vendorGroups[vendorIdx + 1]?.stories[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      <div
        className="relative w-full h-full sm:max-w-md sm:mx-auto bg-black overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* ── Vendor-Grouped Progress Bars ── */}
        <div className={`absolute top-[calc(env(safe-area-inset-top)+16px)] inset-x-4 z-50 flex gap-1.5 pointer-events-none transition-opacity duration-300 ${paused ? 'opacity-0' : 'opacity-100'}`}>
          {currentGroup?.stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-white/20 backdrop-blur-md">
              {i < storyIdx ? (
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === storyIdx ? (
                <div
                  id={progressBarId}
                  key={progressBarId}
                  className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={!isVideo ? {
                    width: (paused || isReplying) ? undefined : '100%',
                    animation: (paused || isReplying) ? 'none' : `story-progress ${STORY_DURATION}ms linear forwards`,
                  } : { width: '0%' }}
                  onAnimationEnd={!isVideo ? handleProgressEnd : undefined}
                />
              ) : (
                <div className="h-full w-0" />
              )}
            </div>
          ))}
        </div>

        {/* ── Header ── */}
        <div className={`absolute top-[calc(env(safe-area-inset-top)+32px)] inset-x-5 z-50 flex items-center justify-between transition-all duration-300 pointer-events-none ${paused ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full p-[2px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-xl">
              <div className="size-full rounded-full overflow-hidden border-2 border-black bg-black">
                {vendorLogo
                  ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                  : <div className="size-full flex items-center justify-center text-xs font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
                }
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[15px] font-black text-white tracking-tight drop-shadow-lg">{storeName}</p>
                <div className="size-1 rounded-full bg-white/40" />
                <span className="text-[10px] font-bold text-white/60">{ago(story.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1 text-[9px] font-black text-[var(--accent)] uppercase tracking-widest">
                  <Sparkles className="size-2.5" /> Official Drop
                </div>
                <div className="size-0.5 rounded-full bg-white/20" />
                <div className="flex items-center gap-1 text-[9px] font-black text-white/40 uppercase tracking-widest">
                  <Tag className="size-2.5" /> {story.category || 'General'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pointer-events-auto">
            {isVideo && (
              <button onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                className="size-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="size-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* ── Story Content ── */}
        <div className="absolute inset-0 z-10 bg-[#050505]">
          <StoryContent
            story={story}
            active={true}
            paused={paused || isReplying}
            muted={muted}
            onVideoEnd={goNext}
            onTimeUpdate={(e) => {
              const bar = document.getElementById(progressBarId);
              if (bar && e.target.duration)
                bar.style.width = `${(e.target.currentTime / e.target.duration) * 100}%`;
            }}
          />

          {nextStory && (
            <div className="hidden" aria-hidden="true">
              {nextStory.type === 'video'
                ? <video src={nextStory.content_url} preload="auto" muted />
                : <img src={nextStory.content_url} alt="" />
              }
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none z-30" />
        </div>

        {/* ── Footer ── */}
        <div className={`absolute bottom-0 inset-x-0 z-50 px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] transition-all duration-300 ${(paused && !isReplying) ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
          {story.caption && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <p className="text-[16px] text-white/95 font-medium leading-relaxed drop-shadow-xl line-clamp-3">{story.caption}</p>
            </motion.div>
          )}

          {story.linked_product && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={(e) => { e.stopPropagation(); handleViewProduct(); }}
              className="w-full mb-6 p-4 rounded-[2rem] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                  <BlurUpImage
                    src={typeof story.linked_product.images?.[0] === 'string' ? story.linked_product.images[0] : story.linked_product.images?.[0]?.url}
                    alt="" className="size-full" objectFit="cover"
                  />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-black text-white tracking-tight uppercase line-clamp-1">{story.linked_product.name}</p>
                  <p className="text-[11px] font-bold text-[var(--accent)] mt-0.5">{story.linked_product.price?.toLocaleString()} XAF</p>
                </div>
              </div>
              <div className="size-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingBag className="size-5" />
              </div>
            </motion.button>
          )}

          {/* Reply + Actions */}
          <div
            className="flex items-center gap-3"
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onFocus={() => setIsReplying(true)}
                onBlur={() => setTimeout(() => setIsReplying(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) { e.preventDefault(); handleSendReply(); } }}
                placeholder="Reply with fire..."
                className="w-full h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/15 px-6 pr-14 text-sm font-medium text-white placeholder:text-white/40 outline-none focus:border-[var(--accent)]/50 focus:bg-white/20 transition-all shadow-xl"
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className={`absolute right-2 size-10 rounded-full flex items-center justify-center transition-all ${replyText.trim() ? 'bg-[var(--accent)] text-white scale-100 shadow-lg' : 'bg-white/5 text-white/20 scale-90'}`}
              >
                <Send className="size-4.5" />
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.stopPropagation(); toggleLike(); }}
              className={`size-14 rounded-full flex items-center justify-center border transition-all shadow-xl ${liked ? 'bg-red-500 border-red-500 text-white' : 'bg-white/10 border-white/15 text-white backdrop-blur-2xl'}`}
            >
              <Heart className={`size-6 ${liked ? 'fill-current' : ''}`} />
            </motion.button>

            <button
              onClick={e => e.stopPropagation()}
              className="size-14 rounded-full bg-white/10 border border-white/15 backdrop-blur-2xl flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-xl"
            >
              <Share2 className="size-5.5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-white/50">
              <Eye className="size-3.5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{story.views_count || 0} views</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <Flame className="size-3 text-orange-500" />
              <span className="text-[10px] font-black text-white/80">
                {storyIdx + 1}/{totalInGroup}
                {totalVendors > 1 && <span className="opacity-40 ml-1">· {vendorIdx + 1}/{totalVendors} vendors</span>}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes story-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </motion.div>
  );
}
