"use client";

import React, { memo } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';


const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url);
};

const VideoThumb = memo(({ src, poster, className }) => {
  const videoRef = React.useRef(null);
  const [videoReady, setVideoReady] = React.useState(false);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Only start loading / playing when the card enters the viewport.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        video.preload = 'auto';
        video.play().catch(() => {});
      },
      { threshold: 0.1 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {/* Actual video — hidden until it has a painted frame */}
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="none"
        onCanPlay={() => setVideoReady(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Poster shown while video loads; gradient fallback if no poster */}
      {!videoReady && (
        poster ? (
          <BlurUpImage
            src={poster}
            alt=""
            className="absolute inset-0 size-full"
            imgClassName="size-full object-cover"
            objectFit="cover"
            priority="auto"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 52%,#321434 100%)' }}
          />
        )
      )}

      {/* Play icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 shadow-xl backdrop-blur-sm">
          <Play className="ml-0.5 size-4 fill-white text-white" />
        </div>
      </div>
    </div>
  );
});
VideoThumb.displayName = 'VideoThumb';


const MediaThumbnail = memo(({ src, poster, alt, className = '', imgClassName = '', objectFit = 'cover', priority = 'auto' }) => {
  if (!src) return null;

  if (isVideoUrl(src)) {
    return (
      <VideoThumb
        src={src}
        poster={poster}
        className={`${className} ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
    );
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
