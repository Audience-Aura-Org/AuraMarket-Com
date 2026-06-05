"use client";

import { memo, useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import BlurUpImage from './BlurUpImage';

const isVideoUrl = (url) => {
  if (!url) return false;
  return /\.(mp4|mov|webm|ogg|m4v)(\?|$)/i.test(url);
};

const VideoThumb = memo(({ src, poster, className }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const el = containerRef.current;
    if (!el || poster) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [poster]);

  useEffect(() => {
    if (!visible || poster) return;
    setStatus('loading');
  }, [visible, poster]);

  const handleMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = 0.1;
    } catch {}
    setStatus('ready');
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-black ${className}`}>
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

      {!poster && (status === 'idle' || status === 'loading') ? (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/30 animate-pulse" />
      ) : null}

      {visible && !poster && status !== 'error' ? (
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          onLoadedMetadata={handleMetadata}
          onError={() => setStatus('error')}
          className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}

      {status === 'error' && !poster ? (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#0a0a0a 0%,#1a1220 100%)' }}
        />
      ) : null}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 shadow-xl backdrop-blur-sm transition-opacity duration-300 ${poster || status === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
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
