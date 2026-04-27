"use client";
import { memo } from 'react';
import BlurUpImage from './BlurUpImage';

/**
 * MediaThumbnail — Smart component that renders either an image or a video preview.
 * For videos:
 * - If Cloudinary: Uses transformation API to get an instant blurred JPEG.
 * - If Other (S3): Uses a muted video tag with preload="metadata" to show the first frame.
 */
const isVideo = (url) => {
  if (!url) return false;
  return url.match(/\.(mp4|mov|webm|ogg|m4v)$|^blob:/i) || url.includes('/video/upload/');
};

const MediaThumbnail = memo(({ src, alt, className, imgClassName, objectFit = 'cover', priority = 'auto' }) => {
  if (!src) return null;

  if (isVideo(src)) {
    // ── Cloudinary Optimization ──────────────────────────────────────────────
    if (src.includes('res.cloudinary.com')) {
      try {
        let poster = src.replace('/video/upload/', '/video/upload/e_blur:800,q_auto:low,f_jpg/');
        poster = poster.replace(/\.[^/.]+$/, ".jpg");
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
      } catch (e) {
        // Fallback to video tag below
      }
    }

    // ── Fallback for S3 / Generic Videos ─────────────────────────────────────
    // Browsers will show the first frame of a muted video if preload="metadata" is set.
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className={`w-full h-full object-${objectFit} transition-all duration-500 ${imgClassName}`}
        />
        {/* Play indicator overlay for video thumbnails */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="size-8 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1" />
           </div>
        </div>
      </div>
    );
  }

  // ── Standard Image ─────────────────────────────────────────────────────────
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
