"use client";
import { useState } from 'react';

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
 *
 * Props:
 *   src          — image URL
 *   alt          — alt text
 *   className    — classes applied to the CONTAINER (position, size, etc.)
 *   imgClassName — classes applied to the sharp image layer
 *   priority     — fetchPriority ("high" | "low" | "auto")
 *   style        — inline styles for the container
 *   objectFit    — "cover" | "contain" (default: "cover")
 */
export default function BlurUpImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  priority = 'auto',
  style,
  objectFit = 'cover',
  draggable = false,
  onLoad,
}) {
  const [sharp, setSharp] = useState(false);

  if (!src) return null;

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* ── Layer 1: blur placeholder (always rendered) ──────────
          Same src → shares browser cache with the sharp layer.
          scale(1.08) hides the blurred edge artifact.
          brightness slightly reduced for depth.
      ──────────────────────────────────────────────────────── */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        fetchPriority={priority}
        decoding="async"
        className={`absolute inset-0 w-full h-full ${fitClass} transition-opacity duration-300 ${
          sharp ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          filter: 'blur(18px) brightness(0.85)',
          transform: 'scale(1.08)',
          willChange: 'opacity',
        }}
      />

      {/* ── Layer 2: sharp image (fades in on load) ───────────── */}
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        fetchPriority={priority}
        decoding="async"
        className={`relative w-full h-full ${fitClass} transition-opacity duration-300 ${
          sharp ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        style={{ willChange: 'opacity' }}
        onLoad={() => {
          setSharp(true);
          onLoad?.();
        }}
      />
    </div>
  );
}
