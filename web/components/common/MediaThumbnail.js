"use client";

import { memo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
};

// ── Video Thumbnail (S3 / generic) ────────────────────────────────────────────
// Uses a <video> element that seeks to the first frame on loadedmetadata.
// On desktop/Android this shows the real thumbnail. On iOS where autoplay/preload
// is blocked, shows a branded gradient + play icon fallback.
const VideoThumb = memo(({ src, className }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  const handleMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    // Seek slightly past 0 — browsers often serve a better frame at 0.1s
    try { v.currentTime = 0.1; } catch (_) {}
    setStatus('ready');
  };

  const handleError = () => setStatus('error');

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {/* Loading shimmer */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/30 animate-pulse" />
      )}

      {/* Actual video frame — visible once metadata is loaded */}
      {status !== 'error' && (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          onLoadedMetadata={handleMetadata}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Error / iOS fallback — gradient with play icon */}
      {status === 'error' && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 100%)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Play badge — always shown over video frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`size-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl transition-opacity duration-300 ${status === 'loading' ? 'opacity-0' : 'opacity-100'}`}
        >
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
    // Cloudinary: generate a real blurred JPEG poster via URL transform
    if (src.includes('res.cloudinary.com')) {
      try {
        const poster = src
          .replace('/video/upload/', '/video/upload/e_blur:800,q_auto:low,f_jpg/')
          .replace(/\.[^/.]+$/, '.jpg');
        return (
          <BlurUpImage
            src={poster}
            alt={alt}
            className={className}
            imgClassName={imgClassName}
            objectFit={objectFit}
            priority={priority}
          />
        );
      } catch (_) {
        // fall through to VideoThumb
      }
    }

    // S3 / generic: real first-frame extraction via <video>
    return <VideoThumb src={src} className={`${className} ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`} />;
  }

  // Standard image
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
