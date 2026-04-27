"use client";
import { memo } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';

/**
 * MediaThumbnail — Smart cross-platform media thumbnail component.
 *
 * Images:   BlurUpImage (progressive blur-up, works everywhere)
 * Cloudinary video: Transforms URL to blurred JPEG poster → BlurUpImage
 * S3/generic video: Premium styled dark placeholder + play icon
 *   (video preload is unreliable on iOS Safari PWA, so we skip the video element)
 */
const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url) || url.includes('/video/upload/');
};

const MediaThumbnail = memo(({ src, alt, className = '', imgClassName = '', objectFit = 'cover', priority = 'auto' }) => {
  if (!src) return null;

  if (isVideoUrl(src)) {
    // ── Cloudinary: generate instant blurred poster via URL transform ──────────
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
        // fall through to placeholder
      }
    }

    // ── S3 / Generic: reliable styled placeholder (works on iOS PWA) ──────────
    return (
      <div
        className={`relative overflow-hidden bg-black ${className}`}
        style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 100%)' }}
      >
        {/* Subtle shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3" />

        {/* Centered play badge */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
            <Play className="size-4 text-white ml-0.5 fill-white" />
          </div>
        </div>

        {/* Bottom gradient strip (mimics a "video thumbnail" look) */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  }

  // ── Standard image ──────────────────────────────────────────────────────────
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
