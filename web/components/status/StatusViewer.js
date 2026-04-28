"use client";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, Heart, ShoppingBag,
  Volume2, VolumeX,
  Eye, Send, Share2, Pause, Play,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';


const STORY_DURATION = 5000;

// ─── Preload helper ─────────────────────────────────────────────────────────
const preloadCache = new Set();
function preloadMedia(url, type) {
  if (!url || preloadCache.has(url)) return;
  preloadCache.add(url);
  if (type === 'video') {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.src = url;
    v.muted = true;
    v.load();
  } else if (type === 'image') {
    const img = new Image();
    img.src = url;
  }
}

// ─── StoryVideo Helper ───────────────────────────────────────────────────────
// Generates an instant poster URL for Cloudinary videos or returns null.
const getVideoPoster = (src) => {
  if (!src) return null;
  // If it's Cloudinary, we can transform the video into a blurred JPEG instantly.
  if (src.includes('res.cloudinary.com')) {
    try {
      // Replace /video/upload/ with /video/upload/e_blur:800,q_auto:low,f_jpg/ 
      // and change extension to .jpg
      let poster = src.replace('/video/upload/', '/video/upload/e_blur:800,q_auto:low,f_jpg/');
      poster = poster.replace(/\.[^/.]+$/, ".jpg");
      return poster;
    } catch (e) {
      return null;
    }
  }
  return null;
};

// ─── StoryVideo ──────────────────────────────────────────────────────────────
// Renders video with a blur-up first-frame poster (canvas extraction).
// Falls back to dark gradient + play icon if CORS blocks canvas.
const StoryVideo = memo(function StoryVideo({ src, muted, active, paused, onEnded, onProgress }) {
  const ref    = useRef(null);
  const srcRef = useRef(src);
  
  // Try to get an instant poster (e.g. Cloudinary transformation)
  const [poster, setPoster] = useState(() => getVideoPoster(src));
  const [videoReady, setVideoReady] = useState(false); 

  // ── Extract first frame as blurred poster (Fallback for non-Cloudinary) ─────
  useEffect(() => {
    if (!src) return;
    
    // If we already have a Cloudinary poster, we don't need the heavy canvas probe
    const instantPoster = getVideoPoster(src);
    if (instantPoster) {
      setPoster(instantPoster);
      setVideoReady(false);
      return;
    }

    setPoster(null);
    setVideoReady(false);

    let cancelled = false;
    const probe = document.createElement('video');
    probe.setAttribute('crossOrigin', 'anonymous'); 
    probe.muted   = true;
    probe.preload = 'metadata';
    probe.src     = src; 

    const onSeeked = () => {
      if (cancelled) return;
      try {
        const w   = Math.min(probe.videoWidth, 640);
        const h   = Math.round(w * (probe.videoHeight / (probe.videoWidth || 1)));
        const cvs = document.createElement('canvas');
        cvs.width  = w;
        cvs.height = h;
        cvs.getContext('2d').drawImage(probe, 0, 0, w, h);
        if (!cancelled) setPoster(cvs.toDataURL('image/jpeg', 0.35));
      } catch {
        // Fallback handled by shimmer in render
      }
    };

    const onMeta = () => {
      if (cancelled) return;
      probe.currentTime = Math.min(0.5, (probe.duration || 5) * 0.1);
    };

    probe.addEventListener('loadedmetadata', onMeta,  { once: true });
    probe.addEventListener('seeked',         onSeeked, { once: true });
    probe.load();

    return () => {
      cancelled = true;
      probe.removeEventListener('loadedmetadata', onMeta);
      probe.removeEventListener('seeked', onSeeked);
      probe.src = ''; 
    };
  }, [src]);

  // ── Imperative src reset ───────────────────────────────────────────────────
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (srcRef.current !== src) {
      srcRef.current = src;
      setVideoReady(false);
      v.load();
    }
  }, [src]);

  // ── Play / pause ───────────────────────────────────────────────────────────
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !paused) {
      const p = v.play();
      if (p) p.catch(() => {});
    } else {
      v.pause();
      if (!active) v.currentTime = 0;
    }
  }, [active, paused]);

  // ── Mute ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  return (
    <div className="absolute inset-0 bg-black">
      {/* ── Poster / Placeholder Layer ── */}
      <div 
        className={`absolute inset-0 z-10 transition-opacity duration-700 ${videoReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="w-full h-full object-cover blur-xl scale-110"
            aria-hidden="true"
          />
        ) : (
          /* Shimmering skeleton while we wait for either the probe or the video itself */
          <div className="w-full h-full animate-shimmer flex items-center justify-center">
             <div className="size-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Play className="size-7 text-white/20 ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* ── Actual Video ── */}
      <video
        ref={ref}
        src={src}
        poster={poster && !src.includes('cloudinary') ? poster : undefined} 
        playsInline
        muted={muted}
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
        onCanPlay={() => setVideoReady(true)}
        onEnded={onEnded}
        onTimeUpdate={onProgress}
      />
    </div>
  );
});

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ count, current, paused, isReplying, isVideo, videoProgress = 0, onEnd }) {
  const timerRef  = useRef(null);
  const startRef  = useRef(null);
  const elapsed   = useRef(0);
  const barRef    = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    if (barRef.current && startRef.current) {
      elapsed.current = Date.now() - startRef.current;
    }
  }, []);

  const run = useCallback(() => {
    startRef.current = Date.now() - elapsed.current;
    const tick = () => {
      if (!barRef.current) return;
      const pct = Math.min(((Date.now() - startRef.current) / STORY_DURATION) * 100, 100);
      barRef.current.style.transform = `scaleX(${pct / 100})`;
      if (pct < 100) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        elapsed.current = 0;
        onEnd();
      }
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [onEnd]);

  // Reset + start on story change
  useEffect(() => {
    elapsed.current = 0;
    if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
    if (!isVideo && !paused && !isReplying) run();
    return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Pause / resume for images
  useEffect(() => {
    if (isVideo) return;
    if (paused || isReplying) stop();
    else run();
  }, [paused, isReplying, isVideo, run, stop]);

  // For video: drive bar from videoProgress (0-100)
  useEffect(() => {
    if (!isVideo || !barRef.current) return;
    barRef.current.style.transform = `scaleX(${videoProgress / 100})`;
  }, [isVideo, videoProgress]);

  return (
    <div className="flex gap-1 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/25">
          {i < current ? (
            <div className="h-full w-full bg-white rounded-full" />
          ) : i === current ? (
            <div
              ref={barRef}
              className="h-full w-full bg-white rounded-full origin-left"
              style={{ transform: 'scaleX(0)', willChange: 'transform' }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

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
        const vendorStories = initialStatuses
          .filter(x => (x.vendor_id?._id || x.vendor_id)?.toString() === vId)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        groups.push({ vendorId: vId, stories: vendorStories });
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
  const [paused,       setPaused]       = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // 0-100 for video
  const [liked,      setLiked]      = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [replyText,  setReplyText]  = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const holdTimer  = useRef(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });

  const currentGroup = vendorGroups[vendorIdx];
  const story        = currentGroup?.stories[storyIdx];
  const totalInGroup = currentGroup?.stories.length || 1;
  const totalVendors = vendorGroups.length;
  const isVideo      = story?.type === 'video';

  // Reset video progress on story change
  useEffect(() => { setVideoProgress(0); }, [vendorIdx, storyIdx]);

  // Preload adjacent stories
  useEffect(() => {
    if (!currentGroup) return;
    const next = currentGroup.stories[storyIdx + 1]
      || vendorGroups[vendorIdx + 1]?.stories[0];
    const prev = currentGroup.stories[storyIdx - 1];
    [next, prev].forEach(s => s && preloadMedia(s.content_url, s.type));
    initialStatuses.forEach(s => {
      if (s.type === 'image') preloadMedia(s.content_url, 'image');
    });
  }, [vendorIdx, storyIdx, currentGroup, vendorGroups, initialStatuses]);

  // Register view on story change
  useEffect(() => {
    if (!story?._id) return;
    api.post(`/statuses/${story._id}/view`).catch(() => {});
  }, [story?._id]);

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

  const handleViewProduct = () => {
    if (!story.linked_product?._id) return;
    onClose();
    router.push(`/products/${story.linked_product._id}`);
  };

  const toggleLike = () => {
    setLiked(l => !l);
    api.post(`/statuses/${story._id}/react`).catch(() => {});
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    const recipientUserId = story.vendor_id?.user_id?._id || story.vendor_id?.user_id;
    if (!recipientUserId) return;
    const text = replyText.trim();
    setReplyText('');
    setIsReplying(false);

    // Send silently
    api.post('/chat', {
      receiver_id: recipientUserId,
      text,
      metadata: {
        type: 'story_reply',
        storyId: story._id,
        storyPreview: story.type === 'text' ? story.text_content : story.content_url
      }
    }).catch(() => {});

    // Dispatch reply event so StatusRow ring updates
    window.dispatchEvent(new CustomEvent('aura_vendor_reply', { detail: story }));
    setPaused(false); // Resume from where it was
  };

  // Touch / pointer handlers
  const onPointerDown = (e) => {
    if (isReplying) return;
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    holdTimer.current = setTimeout(() => setPaused(true), 200);
  };

  const onPointerUp = (e) => {
    if (isReplying) return;
    clearTimeout(holdTimer.current);
    const duration = Date.now() - touchStart.current.t;
    const distY    = e.clientY - touchStart.current.y;

    if (paused) { setPaused(false); return; }
    // Pull down to close
    if (distY > 120 && duration < 400) { onClose(); return; }
  };

  if (!story) return null;

  const storeName  = story.vendor_id?.store_name || 'Aura Vendor';
  const vendorLogo = story.vendor_id?.user_id?.branding?.logo || story.vendor_id?.user_id?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
    >
      {/* ── Story Container ── */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full h-full md:max-w-[420px] bg-black overflow-hidden select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => clearTimeout(holdTimer.current)}
      >
        {/* ── Media Layer ── */}
        <div className="absolute inset-0 z-10">
          {isVideo ? (
            <StoryVideo
              key={story._id}
              src={story.content_url}
              muted={muted}
              active={true}
              paused={paused || isReplying}
              onEnded={goNext}
              onProgress={(e) => {
                const { currentTime, duration } = e.target;
                if (duration > 0) setVideoProgress((currentTime / duration) * 100);
              }}
            />
          ) : story.type === 'image' ? (
            <BlurUpImage
              key={story._id}
              src={story.content_url}
              alt=""
              priority="high"
              className="absolute inset-0 w-full h-full"
              objectFit="cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center p-12 text-center"
              style={{ background: 'linear-gradient(165deg,#050505 0%,#150824 100%)' }}
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[350px] rounded-full bg-[var(--accent)]/12 blur-[100px]" />
              </div>
              <p className="relative z-10 text-3xl font-bold italic text-white leading-tight drop-shadow-2xl">
                {story.text_content}
              </p>
            </div>
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85 pointer-events-none z-20" />
        </div>

        {/* ── Progress Bars ── */}
        <div
          className={`absolute top-[max(env(safe-area-inset-top,0px),14px)] inset-x-4 z-50 pointer-events-none transition-opacity duration-200 ${(paused || isReplying) ? 'opacity-0' : 'opacity-100'}`}
        >
          <ProgressBar
            key={`${vendorIdx}-${storyIdx}`}
            count={totalInGroup}
            videoProgress={videoProgress}
            current={storyIdx}
            paused={paused}
            isReplying={isReplying}
            isVideo={isVideo}
            onEnd={goNext}
          />
        </div>

        {/* ── Header ── */}
        <div
          className={`absolute inset-x-4 z-50 flex items-center justify-between transition-all duration-200 pointer-events-none
            ${(paused || isReplying) ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}
          `}
          style={{ top: 'calc(max(env(safe-area-inset-top, 0px), 14px) + 14px)' }}
        >
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full p-[2px] bg-gradient-to-tr from-[var(--accent)] via-purple-500 to-pink-500 shadow-lg shrink-0">
              <div className="size-full rounded-full overflow-hidden border-2 border-black bg-black">
                {vendorLogo
                  ? <img src={vendorLogo} alt={storeName} className="size-full object-cover" />
                  : <div className="size-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">{storeName[0]}</div>
                }
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-bold text-white tracking-tight drop-shadow">{storeName}</p>
                <span className="text-[9px] text-white/50 font-semibold">{ago(story.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-[var(--accent)]">{story.category || 'General'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Pause indicator */}
            {paused && (
              <div className="size-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Pause className="size-4 text-white" />
              </div>
            )}
            {isVideo && (
              <button
                onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
                className="size-9 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white"
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              className="size-9 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        {/* ── Tap zones (Full height, except footer area) ── */}
        <div className="absolute inset-0 z-40 flex pointer-events-none">
          <div 
            className="w-[35%] h-full pointer-events-auto" 
            onClick={e => { e.stopPropagation(); goPrev(); }} 
          />
          <div 
            className="flex-1 h-full pointer-events-auto" 
            onClick={e => { e.stopPropagation(); goNext(); }} 
          />
        </div>

        {/* ── Bottom Content Stack (Product + Caption + Reply) ── */}
        <div
          className={`absolute bottom-0 inset-x-0 z-50 px-5 pb-[calc(max(env(safe-area-inset-bottom,0px),16px)+12px)] pt-10 transition-all duration-300 pointer-events-none flex flex-col gap-5
            ${isReplying ? 'translate-y-[-10px]' : (paused ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0')}
          `}
        >
          {/* 1. Linked Product (Top of footer stack) */}
          {story.linked_product?.name && (
            <div className="pointer-events-auto relative z-20">
              <button
                onClick={handleViewProduct}
                className="w-full px-4 py-3 rounded-[1.25rem] bg-black/60 backdrop-blur-2xl border border-white/20 flex items-center justify-between active:scale-[0.98] transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-xl overflow-hidden border border-white/10 bg-black/40 shrink-0">
                    {(() => {
                      const imgSrc = typeof story.linked_product.images?.[0] === 'string'
                        ? story.linked_product.images[0]
                        : story.linked_product.images?.[0]?.url || null;
                      return imgSrc
                        ? <img src={imgSrc} alt="" className="size-full object-cover" />
                        : <div className="size-full bg-white/5" />;
                    })()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest leading-none mb-1.5">Shop This Look</p>
                    <p className="text-[14px] font-bold text-white truncate leading-tight">{story.linked_product.name}</p>
                    <p className="text-[12px] font-bold text-white/70 mt-1">{story.linked_product.price?.toLocaleString()} XAF</p>
                  </div>
                </div>
                <div className="size-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg ml-3">
                  <ShoppingBag className="size-5" />
                </div>
              </button>
            </div>
          )}

          {/* 2. Caption (Middle) */}
          {story.caption && (
            <div className="pointer-events-auto relative z-10 px-1">
              <p className="text-[14px] md:text-[15px] text-white/95 font-medium leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-4">
                {story.caption}
              </p>
            </div>
          )}

          {/* 3. Reply row (Bottom) */}
          <div className="flex items-center gap-2.5 pointer-events-auto relative z-20">
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
              onClick={e => e.stopPropagation()}
              className="size-12 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white shadow-lg"
            >
              <Share2 className="size-5" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between px-1 opacity-50">
            <div className="flex items-center gap-1.5 text-white">
              <Eye className="size-3" />
              <span className="text-[9px] font-bold">{story.views_count || 0}</span>
            </div>
            <span className="text-[9px] font-bold text-white">
              {storyIdx + 1} / {totalInGroup}
              {totalVendors > 1 && <span className="opacity-50"> · {vendorIdx + 1}/{totalVendors}</span>}
            </span>
          </div>
        </div>


      </div>
    </motion.div>
  );
}
