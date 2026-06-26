"use client";

import { memo } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';

const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url);
};

const VideoThumb = memo(({ src, poster, className }) => {
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {poster ? (
        <BlurUpImage
          src={poster}
          alt=""
          className="absolute inset-0 size-full"
          imgClassName="size-full object-cover"
          objectFit="cover"
          priority="auto"
        />
      ) : null}

      {!poster ? (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 52%,#321434 100%)' }}
        />
      ) : null}

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
