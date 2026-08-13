"use client";
import { useState, useEffect, useRef, forwardRef } from 'react';

/**
 * BlurUpImage — WhatsApp-style progressive image loading.
 *
 * How it works:
 * - Layer 1 (blur): Same src, always visible, blurred + scaled to fill edges.
 *   Because it's the SAME URL, the browser makes ONE request. The blurred
 *   version appears as soon as any bytes arrive (partial load shows blurry).
 * - Layer 2 (sharp): Starts opacity-0, fades to opacity-1 on onLoad.
 *   Shares the browser cache with Layer 1 — zero extra network cost.
 *
 * Result: No white flash, no stop, no gap — exactly like WhatsApp.
 */
// Global cache for loaded images to prevent re-blurring on re-mount or tab switch
const loadedImages = new Set();

const BlurUpImage = forwardRef(({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  priority = 'auto',
  loading,
  style,
  objectFit = 'cover',
  draggable = false,
  onLoad,
  ...props
}, ref) => {
  const [sharp, setSharp] = useState(() => loadedImages.has(src));
  const imgNodeRef = useRef(null);

  // Handle src changes and also catch images already loaded from browser cache
  useEffect(() => {
    if (!src) return;
    if (loadedImages.has(src)) {
      setSharp(true);
    } else if (imgNodeRef.current?.complete) {
      // Image was served from browser cache — onLoad won't fire, check directly
      loadedImages.add(src);
      setSharp(true);
    } else {
      setSharp(false);
    }
  }, [src]);

  if (!src) return null;

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';
  const imageLoading = loading || (priority === 'high' ? 'eager' : 'lazy');

  // Combine internal ref (for .complete check) with forwarded ref
  const assignRef = (el) => {
    imgNodeRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* ── Layer 1: blur placeholder (only visible while loading) ── */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        fetchPriority={priority}
        loading={imageLoading}
        decoding="async"
        className={`absolute inset-0 w-full h-full ${fitClass} transition-opacity duration-700`}
        style={{
          filter: 'blur(18px) brightness(0.85)',
          transform: 'scale(1.08)',
          willChange: 'opacity',
          opacity: sharp ? 0 : 0.8,
        }}
      />

      {/* ── Layer 2: sharp image (fades in on load) ───────────── */}
      <img
        ref={assignRef}
        src={src}
        alt={alt}
        draggable={draggable}
        fetchPriority={priority}
        loading={imageLoading}
        decoding="async"
        className={`relative w-full h-full ${fitClass} transition-opacity duration-500 ${
          sharp ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        style={{ willChange: 'opacity' }}
        onLoad={() => {
          if (src) loadedImages.add(src);
          setSharp(true);
          onLoad?.();
        }}
        onError={() => {
          // Image failed to load — clear the blur layer so we don't get stuck
          setSharp(true);
        }}
        {...props}
      />
    </div>
  );
});

BlurUpImage.displayName = 'BlurUpImage';

export default BlurUpImage;
