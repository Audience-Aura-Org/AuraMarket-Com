"use client";

import { memo, useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url);
};

// ── VideoThumb ─────────────────────────────────────────────────────────────────
// Uses IntersectionObserver so video metadata only loads when the card is visible.
// This prevents 20-50 simultaneous hidden video requests tanking bandwidth.
const VideoThumb = memo(({ src, className }) => {
  const containerRef = useRef(null);
  const videoRef     = useRef(null);
  const [visible, setVisible] = useState(false);
  const [status,  setStatus]  = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'

  // Reveal when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load video only after visible
  useEffect(() => {
    if (!visible) return;
    setStatus('loading');
  }, [visible]);

  const handleMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    try { v.currentTime = 0.1; } catch {}
    setStatus('ready');
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-black ${className}`}>
      {/* Shimmer while loading */}
      {(status === 'idle' || status === 'loading') && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/30 animate-pulse" />
      )}

      {/* Video — only rendered after in-view */}
      {visible && status !== 'error' && (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          onLoadedMetadata={handleMetadata}
          onError={() => setStatus('error')}
          className={`w-full h-full object-cover transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Error fallback */}
      {status === 'error' && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 100%)' }}
        />
      )}

      {/* Play badge */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`size-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl transition-opacity duration-300 ${status === 'idle' || status === 'loading' ? 'opacity-0' : 'opacity-100'}`}>
          <Play className="size-4 text-white ml-0.5 fill-white" />
        </div>
      </div>
    </div>
  );
});
VideoThumb.displayName = 'VideoThumb';

// ── Main export ───────────────────────────────────────────────────────────────
const MediaThumbnail = memo(({ src, alt, className = '', imgClassName = '', objectFit = 'cover', priority = 'auto' }) => {
  if (!src) return null;

  if (isVideoUrl(src)) {
    return <VideoThumb src={src} className={`${className} ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`} />;
  }

  return (
    <BlurUpImage
      src={src}
      alt={alt}
      className={className}
      imgClassName={imgClassName}
      objectFit={objectFit}
      priority={priority}
    />
  );
});

MediaThumbnail.displayName = 'MediaThumbnail';
export default MediaThumbnail;
