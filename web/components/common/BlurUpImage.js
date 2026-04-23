"use client";
import { useState, useEffect, forwardRef } from 'react';

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
  style,
  objectFit = 'cover',
  draggable = false,
  onLoad,
  ...props
}, ref) => {
  const [sharp, setSharp] = useState(() => loadedImages.has(src));

  // If src changes and it's not in cache, reset sharp
  useEffect(() => {
    if (src && !loadedImages.has(src)) {
      setSharp(false);
    } else if (src && loadedImages.has(src)) {
      setSharp(true);
    }
  }, [src]);

  if (!src) return null;

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* ── Layer 1: blur placeholder (always visible as a base) ── */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        fetchPriority={priority}
        decoding="async"
        className={`absolute inset-0 w-full h-full ${fitClass}`}
        style={{
          filter: 'blur(18px) brightness(0.85)',
          transform: 'scale(1.08)',
          willChange: 'opacity',
          // Stay visible even when sharp is loaded to handle transparent or small images
          opacity: 0.8, 
        }}
      />

      {/* ── Layer 2: sharp image (fades in on load) ───────────── */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        draggable={draggable}
        fetchPriority={priority}
        decoding="async"
        className={`relative w-full h-full ${fitClass} transition-opacity duration-500 ${
          sharp ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        style={{ ...props.style, willChange: 'opacity' }}
        onLoad={() => {
          if (src) loadedImages.add(src);
          setSharp(true);
          onLoad?.();
        }}
        {...props}
      />
    </div>
  );
});

BlurUpImage.displayName = 'BlurUpImage';

export default BlurUpImage;
