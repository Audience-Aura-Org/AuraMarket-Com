"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Search,
  Plus, Palette, SplitSquareHorizontal, Scissors,
  Crop, Sticker, Pencil, AtSign,
  Volume2, VolumeX, Tag, Sliders,
  Play, Pause
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { uploadService } from '@/services/upload';
import api from '@/services/api';
import { STATUS_CATEGORIES } from '@/constants/statusCategories';
import {
  STATUS_VIDEO_MAX_BYTES,
  STATUS_VIDEO_INPUT_MAX_BYTES,
  STATUS_IMAGE_MAX_BYTES,
  STATUS_VIDEO_MAX_SECONDS,
} from '@/constants/statusVideo';
import { prepareStatusVideoForUpload, isAndroidNative } from '@/lib/statusVideoExport';
import { useUploadQueue } from '@/context/UploadQueueContext';

const DURATION_OPTIONS = [
  { value: 1, label: '1 Day', description: 'Quick drop' },
  { value: 3, label: '3 Days', description: 'Standard', recommended: true },
  { value: 7, label: '7 Days', description: 'Max reach' },
];

const VIDEO_POST_MODES = [
  { id: 'split', label: 'Split', description: 'Post every 30s part', icon: SplitSquareHorizontal },
  { id: 'trim', label: 'Trim', description: 'Post selected clip', icon: Scissors },
];

const DEVICE_TYPE = () => {
  if (typeof window === 'undefined') return 'desktop';
  if (Capacitor?.isNativePlatform?.()) return 'mobile';
  return window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
};

const isNativePlatform = () =>
  typeof Capacitor !== 'undefined' && Capacitor?.isNativePlatform?.();

const needsOffscreenFilmstripCapture = () =>
  isNativePlatform() || isAndroidNative();

const kickVideoDecoder = async (video, { delayMs = 100 } = {}) => {
  if (!video) return;
  try {
    await video.play();
    // ── CRITICAL FIX ────────────────────────────────────────────────────────
    // On Android WebView, calling play() then immediately pause() means the HW
    // decoder never commits a real frame to the compositor surface — every
    // subsequent drawImage / createImageBitmap returns pure black.
    // We MUST wait for timeupdate, which fires only after the decoder has
    // decoded and presented at least one real frame, before capturing.
    await new Promise((resolve) => {
      video.addEventListener('timeupdate', resolve, { once: true });
      setTimeout(resolve, 800); // safety fallback if timeupdate is very slow
    });
    video.pause();
  } catch (_) {}
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};

const isMobileWeb = () => {
  if (typeof window === 'undefined') return false;
  if (isNativePlatform()) return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/** Safari needs #t= on remote URLs for first-frame paint; blob/data URLs break with fragments on mobile Chrome. */
const buildPreviewVideoSrc = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('#')) return url;
  return `${url}#t=0.001`;
};

const canUseVideoFrameCallback = () =>
  !isNativePlatform()
  && !isMobileWeb()
  && typeof HTMLVideoElement !== 'undefined'
  && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

const waitForPreviewVideo = (videoRef, timeoutMs = 12000) =>
  new Promise((resolve) => {
    let elapsed = 0;
    const check = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        resolve(video);
        return;
      }
      elapsed += 100;
      if (elapsed >= timeoutMs) {
        resolve(videoRef.current);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });

// ── Frame capture helper ───────────────────────────────────────────────────
// On Android WebView, BOTH drawImage(video) and createImageBitmap(video) return
// pure black unless called during a requestAnimationFrame tick while the video
// is actively playing (not paused, not just seeked).
// createImageBitmap silently returns a black ImageBitmap — it does NOT throw —
// so the previous try/catch fallback never ran.
// Rule: always capture inside rAF while playing; pause AFTER the draw.
//
// v1.9: add ImageCapture.grabFrame() as the primary path.
// grabFrame() reads directly from the HW decoder's media pipeline —
// it is NOT subject to the compositor surface flush delay that causes
// rAF + drawImage to return black on many Android WebView builds.
// The rAF + drawImage path remains as a fallback for browsers without
// the ImageCapture API (e.g. Firefox, older Safari).
const drawVideoToCanvas = async (video, canvas, ctx) => {
  if (typeof ImageCapture !== 'undefined' && typeof video.captureStream === 'function') {
    try {
      const stream = video.captureStream();
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        const ic = new ImageCapture(tracks[0]);
        const bitmap = await ic.grabFrame();
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
    } catch (_) { /* fall through to rAF */ }
  }
  // Fallback: rAF + drawImage (reliable on desktop, may draw black on some Android WebView)
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve();
    });
  });
};

const seekVideoFrame = (video, targetTime, canvas, ctx) =>
  new Promise((resolve) => {
    let resolved = false;
    const isNative = needsOffscreenFilmstripCapture();
    const isMob = isMobileWeb();

    // Async capture — resolved exactly once (resolved flag is set synchronously).
    const capture = async () => {
      if (resolved) return;
      resolved = true; // set synchronously before any awaits to block re-entry
      try {
        if (isNative) {
          await drawVideoToCanvas(video, canvas, ctx);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      } catch {
        resolve(null);
      }
    };

    // How long to wait after seeked before drawing.
    // Android HW decoder commits the pixel surface asynchronously after seeked fires.
    const postSeekDelay = isNative ? 380 : isMob ? 150 : 60;

    // Hard outer timeout — fires if seeked never arrives.
    const hardTimer = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      capture();
    }, isNative ? 3500 : isMob ? 2000 : 1200);

    const onSeeked = async () => {
      if (isNative) {
        // ── Android HW decoder fix ───────────────────────────────────────────
        // After a seek on Android, the surface is still black until the decoder
        // actively outputs frames. We must play until timeupdate fires (= first
        // real frame presented) and capture WHILE the video is still playing.
        // Waiting a fixed delay after seeked (previous approach) is not enough.
        try {
          await video.play();
          await new Promise((r) => {
            video.addEventListener('timeupdate', r, { once: true });
            setTimeout(r, 600);
          });
          clearTimeout(hardTimer);
          await capture();
          video.pause();
        } catch {
          clearTimeout(hardTimer);
          await capture();
        }
        return;
      }
      // On desktop, requestVideoFrameCallback is the most reliable paint signal.
      if (canUseVideoFrameCallback()) {
        video.requestVideoFrameCallback(() => {
          clearTimeout(hardTimer);
          capture();
        });
        return;
      }
      // Mobile web: short fixed delay is sufficient.
      setTimeout(() => {
        clearTimeout(hardTimer);
        capture();
      }, postSeekDelay);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = targetTime;
  });


const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.78) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

async function generateVideoThumbnail(file) {
  if (!file?.type?.startsWith('video/')) return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  
  // ── CRITICAL for Android WebView ────────────────────────────────────────
  // The video element MUST be a real, visible size (at least 160×90).
  // If it is 1×1px, Android's hardware decoder skips rendering frames and
  // every drawImage() call produces a pure-black canvas frame.
  // opacity:0.01 (not 0.002) — some Android WebView versions require a slightly
  // higher opacity for the compositor to allocate a real pixel surface.
  video.style.position = 'fixed';
  video.style.top = '0px';
  video.style.left = '0px';
  video.style.width = '160px';
  video.style.height = '90px';
  video.style.opacity = '0.01';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '9999';
  document.body.appendChild(video);

  const metadataLoaded = new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    video.onloadedmetadata = done;
    video.onloadeddata = done;
    video.oncanplay = done;
    video.onerror = done;
    setTimeout(done, 3000); // 3 s safety — enough for any decoder
  });

  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.src = objectUrl;
  video.load();

  try {
    await metadataLoaded;
    
    const isNative = isNativePlatform();

    // Seek to 10% of duration for a representative frame
    const seekTo = Math.min(1, Math.max(0.1, (video.duration || 1) * 0.1));
    await new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      video.addEventListener('seeked', done, { once: true });
      video.onerror = done;
      setTimeout(done, 1000);
      video.currentTime = seekTo;
    });

    // Play until timeupdate — the ONLY reliable way to get the HW decoder to
    // commit a real pixel surface on Android WebView. kickVideoDecoder alone
    // (play+pause) is insufficient because pause can fire before any frame is
    // decoded, and subsequent drawImage/createImageBitmap both return black.
    await video.play();
    await new Promise((r) => {
      video.addEventListener('timeupdate', r, { once: true });
      setTimeout(r, 800); // safety timeout
    });

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const thumbCtx = canvas.getContext('2d');

    // Capture inside rAF while video is still playing (not yet paused).
    // On Android WebView, drawImage(video) only returns real pixels when called
    // during an active rAF tick while the video is outputting frames.
    await drawVideoToCanvas(video, canvas, thumbCtx);
    video.pause();

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.78);
    if (!blob) return null;

    const baseName = (file.name || 'status-video').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}-poster.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Failed to generate video thumbnail", e);
    return null;
  } finally {
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }
    URL.revokeObjectURL(objectUrl);
  }
}

async function readVideoMetadata(file) {
  if (!file?.type?.startsWith('video/')) return null;
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  
  // ── CRITICAL for Android WebView ────────────────────────────────────────
  // The video element MUST be a real, visible size (at least 160×90).
  // If it is 1×1px, Android's hardware decoder skips rendering frames and
  // fails to fire metadata loading events.
  // We position it on-screen at opacity 0.002 so it's technically visible
  // to the compositor but completely unnoticeable to the user.
  video.style.position = 'fixed';
  video.style.top = '0px';
  video.style.left = '0px';
  video.style.width = '160px';
  video.style.height = '90px';
  video.style.opacity = '0.01';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '9999';
  document.body.appendChild(video);

  const metadataLoaded = new Promise((resolve, reject) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    video.onloadedmetadata = done;
    video.onloadeddata = done;
    video.oncanplay = done;
    video.onerror = done;
    setTimeout(done, 3500); // Android browser can delay local video metadata
  });

  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.src = objectUrl;
  video.load();

  try {
    await metadataLoaded;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : STATUS_VIDEO_MAX_SECONDS;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;

    return {
      duration,
      width,
      height,
      objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  } finally {
    if (video.parentNode) {
      video.parentNode.removeChild(video);
    }
  }
}

const TEXT_GRADIENTS = [
  { style: { background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)' }, name: 'Sunset' },
  { style: { background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' }, name: 'Ocean' },
  { style: { background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' }, name: 'Purple Dream' },
  { style: { background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }, name: 'Neon Green' },
  { style: { background: 'linear-gradient(135deg, #0f0c1b 0%, #201335 100%)' }, name: 'Midnight' },
  { style: { background: 'linear-gradient(135deg, #e65c00 0%, #F9D423 100%)' }, name: 'Warm Sun' },
];

const TEXT_FONTS = [
  { className: 'font-[Poppins]', name: 'Poppins' },
  { className: 'font-quicksand font-bold', name: 'Quicksand' },
  { className: 'font-[Georgia] italic', name: 'Serif' },
  { className: 'font-[Courier_New] font-black', name: 'Monospace' },
];

const formatSeconds = (seconds = 0) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

const buildVideoSegments = (duration = 0) => {
  const safeDuration = Math.max(0, Number(duration) || 0);
  if (!safeDuration) return [{ start: 0, end: STATUS_VIDEO_MAX_SECONDS, index: 0 }];

  const segments = [];
  for (let start = 0; start < safeDuration - 0.05; start += STATUS_VIDEO_MAX_SECONDS) {
    segments.push({
      start,
      end: Math.min(start + STATUS_VIDEO_MAX_SECONDS, safeDuration),
      index: segments.length,
    });
  }
  return segments;
};

/**
 * runVideoUploadTask
 * Standalone async function that does the full video upload + publish pipeline.
 * Runs entirely outside any React component lifecycle — safe to call after
 * the StatusCreator modal has unmounted.
 *
 * @param {object} snapshot - State values captured at the moment the user tapped Share
 * @param {{ onProgress: Function, onPhase: Function }} callbacks
 * @returns {Promise<Array>} Array of created status objects
 */
async function runVideoUploadTask(snapshot, { onProgress, onPhase }) {
  const {
    file, type, trimStart, trimEnd, cropMode, videoPostMode,
    videoMeta, selectedCategory, caption, linkedProduct, expiryDays,
  } = snapshot;

  const createdStatuses = [];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const createStatusPayload = (overrides = {}) => ({
    type,
    content_url: '',
    thumbnail_url: '',
    text_content: '',
    caption,
    linked_product: linkedProduct?._id || null,
    expires_at: expiresAt.toISOString(),
    expiry_days: expiryDays,
    category: selectedCategory,
    ...overrides,
  });

  const segments = videoPostMode === 'split'
    ? buildVideoSegments(videoMeta?.duration || trimEnd)
    : [{ start: trimStart, end: trimEnd, index: 0 }];
  const totalSegments = segments.length;

  for (const segment of segments) {
    const segmentNumber = segment.index + 1;
    const clipLength = segment.end - segment.start;
    if (clipLength > STATUS_VIDEO_MAX_SECONDS + 0.5) {
      throw new Error(`Story clips must be ${STATUS_VIDEO_MAX_SECONDS} seconds or less.`);
    }

    onPhase(totalSegments > 1
      ? `Preparing part ${segmentNumber} of ${totalSegments}...`
      : 'Preparing video...'
    );

    const preparedVideo = await prepareStatusVideoForUpload(file, {
      trimStart: segment.start,
      trimEnd: segment.end,
      cropMode,
      onProgress: (pct) => {
        const progress = ((segment.index + (pct / 100)) / totalSegments) * 70;
        onProgress(Math.min(70, Math.round(progress)));
      },
    });

    let segmentUrl = '';
    let thumbnailSource = file;

    if (preparedVideo.mode === 'server') {
      if (!preparedVideo.uploadResult?.success) {
        throw new Error(preparedVideo.uploadResult?.message || 'Server video trim failed.');
      }
      segmentUrl = preparedVideo.uploadResult.data.url;
      onProgress(Math.min(95, Math.round(((segment.index + 1) / totalSegments) * 95)));
    } else {
      const uploadFile = preparedVideo.file;
      if (uploadFile.size > STATUS_VIDEO_MAX_BYTES) {
        throw new Error('Edited video is still above 16MB. Shorten the trim and try again.');
      }
      onPhase(totalSegments > 1
        ? `Uploading part ${segmentNumber} of ${totalSegments}...`
        : 'Uploading video...'
      );
      const uploadRes = await uploadService.uploadSingle(uploadFile, 'statuses', {
        onProgress: (pct) => {
          const progress = 70 + (((segment.index + (pct / 100)) / totalSegments) * 25);
          onProgress(Math.min(95, Math.round(progress)));
        },
      });
      if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
      segmentUrl = uploadRes.data.url;
      thumbnailSource = uploadFile;
    }

    onPhase(totalSegments > 1
      ? `Creating preview ${segmentNumber} of ${totalSegments}...`
      : 'Creating preview...'
    );
    const thumbnailFile = await generateVideoThumbnail(thumbnailSource);
    let segmentThumbnailUrl = '';
    if (thumbnailFile) {
      const thumbnailRes = await uploadService.uploadSingle(thumbnailFile, 'statuses');
      if (thumbnailRes.success) segmentThumbnailUrl = thumbnailRes.data.url;
    }

    onPhase(totalSegments > 1
      ? `Publishing part ${segmentNumber} of ${totalSegments}...`
      : 'Publishing story...'
    );
    const res = await api.post('/statuses', createStatusPayload({
      content_url: segmentUrl,
      thumbnail_url: segmentThumbnailUrl,
    }));
    if (!res.data?.success) throw new Error(res.data?.message || 'Status creation failed');
    createdStatuses.push(res.data.data);
  }

  return createdStatuses;
}

export default function StatusCreator({ onClose, onStatusCreated, initialData = null }) {
  const isReshare = !!initialData;
  const { enqueueUpload } = useUploadQueue();

  const [, setDeviceType] = useState('desktop');
  const [type, setType]                 = useState(initialData?.type || 'image');
  const [file, setFile]                 = useState(null);
  const [previewUrl, setPreviewUrl]     = useState(initialData?.content_url || '');
  const [textContent, setTextContent]   = useState(initialData?.text_content || '');
  const [caption, setCaption]           = useState(initialData?.caption || '');
  const [linkedProduct, setLinkedProduct] = useState(null);
  const [products, setProducts]         = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [loading, setLoading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase]   = useState('');
  const [error, setError]               = useState(null);
  const [expiryDays, setExpiryDays]     = useState(initialData?.expiry_days || 3);
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || 'Moment');
  const [mounted, setMounted]           = useState(false);
  const [videoMeta, setVideoMeta]       = useState(null);
  const [trimStart, setTrimStart]       = useState(0);
  const [trimEnd, setTrimEnd]           = useState(STATUS_VIDEO_MAX_SECONDS);
  const [videoPostMode, setVideoPostMode] = useState('trim');
  const [, setEditingVideo] = useState(false);
  const [gradientIndex, setGradientIndex] = useState(0);
  const [muted, setMuted]               = useState(true);
  const [cropMode, setCropMode]         = useState('crop');

  // WhatsApp Layout Specific States
  const [currentTime, setCurrentTime]   = useState(0);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSettingsPicker, setShowSettingsPicker] = useState(false);
  const [showTrimmer, setShowTrimmer]   = useState(true);
  const [fontFamilyIndex, setFontFamilyIndex] = useState(1); // Default to Quicksand (index 1)
  const [timelineFrames, setTimelineFrames] = useState([]);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const previewVideoRef = useRef(null);
  const trimmerTrackRef = useRef(null);

  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  const initialFrameSurfacedRef = useRef(false); // one-shot per video pick — prevents repeated seek

  const [isPlaying, setIsPlaying] = useState(true);

  const resetMediaInputs = () => {
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const clearSelectedMedia = () => {
    resetMediaInputs();
    setFile(null);
    setPreviewUrl('');
    setVideoMeta(null);
    setVideoPostMode('trim');
    setEditingVideo(false);
    setTimelineFrames([]);
    setTrimStart(0);
    setTrimEnd(STATUS_VIDEO_MAX_SECONDS);
  };

  const togglePlayPause = () => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };
  
  useEffect(() => {
    trimStartRef.current = trimStart;
  }, [trimStart]);

  useEffect(() => {
    trimEndRef.current = trimEnd;
  }, [trimEnd]);

  useEffect(() => {
    if (type !== 'video' || !previewUrl) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
  }, [type, previewUrl]);

  // Reset the one-shot frame-surface flag every time a new video is picked.
  useEffect(() => { initialFrameSurfacedRef.current = false; }, [previewUrl]);

  // Sync main preview video playback range with trimmer start/end
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;

    if (video.currentTime < trimStart || video.currentTime > trimEnd) {
      video.currentTime = trimStart;
      setCurrentTime(trimStart);
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= trimEnd - 0.05) {
        video.currentTime = trimStart;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [trimStart, trimEnd, previewUrl]);

  // Native-only: imperatively set src + call load() so Android WebView actually
  // buffers the blob: URL. React's JSX src prop does NOT guarantee the attribute
  // is flushed to the DOM before the autoplay effect fires, causing intermittent
  // blank previews. This effect runs ONLY when previewUrl changes so it never
  // resets the video mid-play due to unrelated state changes (muted, isPlaying).
  useEffect(() => {
    if (!isNativePlatform()) return;
    const video = previewVideoRef.current;
    if (!video || !previewUrl || type !== 'video') return;
    video.src = previewUrl;
    video.load();
  }, [previewUrl, type]);

  // Autoplay the visible preview as soon as the picked file is ready.
  // Deps: only [previewUrl, type] — isPlaying/muted changes are handled by the
  // sync effect below so we never re-register listeners on a playing video.
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !previewUrl || type !== 'video') return;

    let cancelled = false;

    const tryPlay = () => {
      if (cancelled) return;
      // On native: seek to 0.001 BEFORE (and regardless of) play() outcome.
      // If play() is rejected by Android WebView (AbortError from a load race, or
      // gesture context expired), the .then() never runs and the screen stays black.
      // Seeking unconditionally ensures the first frame is always surfaced.
      if (isNativePlatform() && !initialFrameSurfacedRef.current) {
        initialFrameSurfacedRef.current = true;
        setTimeout(() => {
          if (!cancelled) video.currentTime = 0.001;
        }, 400);
      }
      video.play().catch(() => {});
    };

    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay',    tryPlay, { once: true });

    // Fallback: if loadeddata / canplay never fire (e.g. codec timeout on slow HW)
    // try playing directly. Longer timeout on native covers slow hardware decoders.
    const fallback = setTimeout(tryPlay, isNativePlatform() ? 1200 : 250);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, type]);

  // Set Android WebView-specific video attributes that React drops when passed as JSX props.
  // webkit-playsinline / x5-playsinline / x5-video-player-type must be set imperatively.
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v || !isNativePlatform()) return;
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('x5-video-player-type', 'h5');
    v.setAttribute('x5-playsinline', 'true');
  }, [previewUrl]);

  // Handle play/pause commands from user interaction
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !previewUrl || type !== 'video') return;
    video.muted = muted;
    if (isPlaying) {
      // readyState=0 means video.load() just started (native effect just fired).
      // Calling play() here causes a silent AbortError on Android WebView because
      // the media pipeline hasn't initialized yet. The autoplay effect's
      // loadeddata/canplay listeners (or the 1200ms fallback) will call play()
      // once there is enough data. On web, call play() immediately as usual.
      if (video.readyState >= 1 || !isNativePlatform()) {
        video.play().catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [isPlaying, muted, previewUrl, type]);

  // Sync play/pause events from native element back to state
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;

    const syncPlayState = () => setIsPlaying(!video.paused && !video.ended);

    video.addEventListener('play', syncPlayState);
    video.addEventListener('pause', syncPlayState);
    video.addEventListener('ended', syncPlayState);

    return () => {
      video.removeEventListener('play', syncPlayState);
      video.removeEventListener('pause', syncPlayState);
      video.removeEventListener('ended', syncPlayState);
    };
  }, [previewUrl]);

  useEffect(() => {
    setMounted(true);
    setDeviceType(DEVICE_TYPE());
    const handleResize = () => setDeviceType(DEVICE_TYPE());
    window.addEventListener('resize', handleResize);
    return () => {
      setMounted(false);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Revoke preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && !initialData?.content_url) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, initialData]);

  // Load products for tagging
  useEffect(() => {
    api.get('/vendor/products')
      .then(res => { if (res.data.success) setProducts(res.data.data.products || []); })
      .catch(() => {});
  }, []);

  // Pre-load linked product for reshare
  useEffect(() => {
    if (initialData?.linked_product) {
      const match = products.find(p => p._id === initialData.linked_product?._id || p._id === initialData.linked_product);
      if (match) setLinkedProduct(match);
    }
  }, [products, initialData]);

  // ESC to close
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('aura_status_composer_visibility', { detail: { open: true } }));
    return () => {
      document.body.style.overflow = 'unset';
      window.dispatchEvent(new CustomEvent('aura_status_composer_visibility', { detail: { open: false } }));
    };
  }, []);

  // Build the 8-frame filmstrip once the live preview video is decoded.
  useEffect(() => {
    if (type !== 'video' || !previewUrl || !videoMeta?.duration) {
      return undefined;
    }
    // Android WebView has 1-2 hardware decoder slots. Creating a second offscreen
    // video element here competes with the main preview and causes both to show
    // black frames. Skip canvas-based frame extraction on native; the placeholder
    // skeleton (animated gradient bars) renders when timelineFrames is empty.
    if (isNativePlatform()) return undefined;

    let cancelled = false;
    setTimelineFrames([]);

    // Create a dedicated off-screen video element for extracting filmstrip frames.
    // This avoids messing with the main preview video (eliminating playback skips)
    // and works reliably on Android WebViews by matching the thumbnail extraction setup.
    const video = document.createElement('video');
    video.style.position = 'fixed';
    video.style.top = '0px';
    video.style.left = '0px';
    video.style.width = '160px';
    video.style.height = '90px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '9999';
    document.body.appendChild(video);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');

    const captureTimelineFrames = async () => {
      try {
        // On native: wait for the main preview + trimmer to acquire the HW decoder
        // first. Android has limited concurrent decoder slots (~1-2); loading all
        // three video elements simultaneously causes all to show black frames.
        if (isNativePlatform()) {
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) return;
        }

        // Set up metadata promise and start loading the offscreen video NOW
        // (after the delay on native, immediately on web).
        const metadataLoaded = new Promise((resolve) => {
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          video.onloadedmetadata = done;
          video.onloadeddata = done;
          video.oncanplay = done;
          video.onerror = done;
          setTimeout(done, needsOffscreenFilmstripCapture() ? 3000 : 2500);
        });

        video.src = previewUrl;
        video.load();

        await metadataLoaded;
        if (cancelled) return;

        // APK / native WebView: always capture from the dedicated 160×90 off-screen
        // element. Android HW decoders skip canvas reads from the full-screen preview.
        let captureVideo = video;

        if (!needsOffscreenFilmstripCapture()) {
          const previewVideo = await waitForPreviewVideo(previewVideoRef, isMobileWeb() ? 5000 : 3000);
          if (!cancelled && previewVideo?.readyState >= 2 && previewVideo.videoWidth > 0) {
            captureVideo = previewVideo;
          }
        }

        const decoderDelay = needsOffscreenFilmstripCapture() ? 380 : isMobileWeb() ? 180 : 100;
        if (captureVideo.readyState < 2 || captureVideo.videoWidth === 0) {
          await kickVideoDecoder(captureVideo, { delayMs: decoderDelay });
        } else if (needsOffscreenFilmstripCapture()) {
          await kickVideoDecoder(captureVideo, { delayMs: decoderDelay });
        }

        // On Capacitor, seek to 0.001 after the kick and wait for the HW decoder
        // to commit its first surface before starting frame-by-frame capture.
        if (needsOffscreenFilmstripCapture()) {
          captureVideo.currentTime = 0.001;
          await new Promise((r) => setTimeout(r, 200));
        }

        const duration = videoMeta.duration;
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const numFrames = 8;
        const wasPaused = captureVideo.paused;
        const usingPreviewElement = captureVideo !== video;

        try {
          captureVideo.pause();

          for (let i = 0; i < numFrames; i++) {
            if (cancelled) break;
            if (needsOffscreenFilmstripCapture() && i > 0) {
              // Inter-frame pause on Capacitor — Android HW decoder needs
              // time to commit each new surface after a seek.
              await new Promise((resolve) => setTimeout(resolve, 150));
            }
            const time =
              i === 0
                ? 0.05
                : (i / (numFrames - 1)) * Math.max(duration - 0.05, 0.1);
            let dataUrl = await seekVideoFrame(captureVideo, time, canvas, ctx);
            if (!dataUrl && needsOffscreenFilmstripCapture()) {
              await kickVideoDecoder(captureVideo, { delayMs: 150 });
              dataUrl = await seekVideoFrame(captureVideo, time, canvas, ctx);
            }
            if (dataUrl && !cancelled) {
              setTimelineFrames((prev) => [...prev, dataUrl]);
            }
          }
        } finally {
          if (usingPreviewElement && !wasPaused && !cancelled) {
            captureVideo.play().catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Failed to generate timeline frames', e);
      } finally {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      }
    };

    captureTimelineFrames().catch((e) => {
      console.warn('Failed to generate timeline frames', e);
    });

    return () => {
      cancelled = true;
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };
  }, [type, previewUrl, videoMeta?.duration]);

  const handleFileChange = async (e, nextType = type) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (previewUrl && file) URL.revokeObjectURL(previewUrl);

    if (nextType === 'video') {
      if (!f.type.startsWith('video/'))  { setError('Select a video file.'); return; }
      if (f.size > STATUS_VIDEO_INPUT_MAX_BYTES) { setError('Max 500MB source video.'); return; }

      try {
        const meta = await readVideoMetadata(f);
        if (meta.objectUrl) URL.revokeObjectURL(meta.objectUrl);
        const needsTrim = meta.duration > STATUS_VIDEO_MAX_SECONDS + 0.5;
        const needsCompression = f.size > STATUS_VIDEO_MAX_BYTES;
        setVideoMeta({ ...meta, needsTrim, needsCompression });
        setTrimStart(0);
        setTrimEnd(Math.min(STATUS_VIDEO_MAX_SECONDS, Math.max(1, meta.duration || STATUS_VIDEO_MAX_SECONDS)));
        setVideoPostMode('trim');
        setEditingVideo(true);
        setError(needsTrim
          ? null
          : needsCompression
            ? 'Video will be cropped to 9:16 and optimized before upload.'
            : null
        );
      } catch (err) {
        setError(err.message || 'Could not read video metadata.');
        return;
      }
    } else {
      if (!f.type.startsWith('image/'))  { setError('Select an image file.'); return; }
      if (f.size > STATUS_IMAGE_MAX_BYTES)    { setError('Max 8MB image.'); return; }
      setVideoMeta(null);
      setVideoPostMode('trim');
      setEditingVideo(false);
      setTimelineFrames([]);
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (nextType !== 'video') setError(null);
  };

  const handlePost = async () => {
    if (!selectedCategory) { setError('Please select a category.'); return; }

    // ── VIDEO: hand off to background queue immediately, close modal ─────────
    if (type === 'video' && file) {
      // Snapshot all state values at click time — the component may unmount
      // before the upload finishes, so we cannot reference React state inside the task.
      const snapshot = {
        file, type, trimStart, trimEnd, cropMode, videoPostMode,
        videoMeta, selectedCategory, caption, linkedProduct, expiryDays,
      };

      enqueueUpload(
        (callbacks) => runVideoUploadTask(snapshot, callbacks),
        {
          label: 'Uploading story...',
          onSuccess: (statuses) => {
            onStatusCreated?.(statuses.length === 1 ? statuses[0] : statuses);
          },
        }
      );

      // Clear form and close — upload continues in the background
      clearSelectedMedia();
      onClose();
      return;
    }

    // ── IMAGE / TEXT: synchronous (fast, no background needed) ───────────────
    setLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    setError(null);
    try {
      let finalUrl = previewUrl;
      let thumbnailUrl = initialData?.thumbnail_url || '';
      const createdStatuses = [];

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const createStatusPayload = (overrides = {}) => ({
        type,
        content_url: type !== 'text' ? finalUrl : '',
        thumbnail_url: type === 'video' ? thumbnailUrl : '',
        text_content: type === 'text' ? textContent : '',
        caption,
        linked_product: linkedProduct?._id || null,
        expires_at: expiresAt.toISOString(),
        expiry_days: expiryDays,
        category: selectedCategory,
        ...overrides,
      });

      const publishStatus = async (payload) => {
        try {
          const res = await api.post('/statuses', payload);
          if (!res.data.success) {
            // Detailed error logging for mobile debugging
            console.error('[STATUS_PUBLISH_ERROR] API returned failure', {
              status: res.status,
              code: res.data?.code,
              message: res.data?.message,
              fullResponse: res.data,
            });
            throw new Error(res.data.message || 'Status creation failed');
          }
          createdStatuses.push(res.data.data);
        } catch (err) {
          // Log full error context for debugging
          console.error('[STATUS_PUBLISH_ERROR] Request failed', {
            status: err.response?.status,
            code: err.response?.data?.code,
            message: err.response?.data?.message || err.message,
            errorType: err.response?.status === 402 ? 'SUBSCRIPTION_REQUIRED' : 
                      err.response?.status === 403 ? 'VENDOR_NOT_FOUND' : 
                      'UNKNOWN',
            fullResponse: err.response?.data,
            requestPayload: { type: payload.type, hasContent: !!payload.content_url },
          });
          throw err;
        }
      };

      if (type !== 'text' && file) {
        if (file.type.startsWith('video/')) {
          const segments = videoPostMode === 'split'
            ? buildVideoSegments(videoMeta?.duration || trimEnd)
            : [{ start: trimStart, end: trimEnd, index: 0 }];
          const totalSegments = segments.length;

          for (const segment of segments) {
            const segmentNumber = segment.index + 1;
            const clipLength = segment.end - segment.start;
            if (clipLength > STATUS_VIDEO_MAX_SECONDS + 0.5) {
              throw new Error(`Story clips must be ${STATUS_VIDEO_MAX_SECONDS} seconds or less.`);
            }

            setUploadPhase(totalSegments > 1
              ? `Preparing part ${segmentNumber} of ${totalSegments}...`
              : 'Preparing video...'
            );
            const preparedVideo = await prepareStatusVideoForUpload(file, {
              trimStart: segment.start,
              trimEnd: segment.end,
              cropMode,
              onProgress: (pct) => {
                const progress = ((segment.index + (pct / 100)) / totalSegments) * 70;
                setUploadProgress(Math.min(70, Math.round(progress)));
              },
            });

            console.log('[StatusCreator] Video prepared', {
              segmentNumber,
              mode: preparedVideo.mode,
              hasUploadResult: !!preparedVideo.uploadResult,
              uploadSuccess: preparedVideo.uploadResult?.success,
              error: preparedVideo.uploadResult?.message,
            });

            let segmentUrl = '';
            let thumbnailSource = file;

            if (preparedVideo.mode === 'server') {
              if (!preparedVideo.uploadResult?.success) {
                throw new Error(preparedVideo.uploadResult?.message || 'Server video trim failed.');
              }
              segmentUrl = preparedVideo.uploadResult.data.url;
              setUploadProgress(Math.min(95, Math.round(((segment.index + 1) / totalSegments) * 95)));
            } else {
              const uploadFile = preparedVideo.file;
              if (uploadFile.size > STATUS_VIDEO_MAX_BYTES) {
                throw new Error('Edited video is still above 16MB. Shorten the trim and try again.');
              }

              setUploadPhase(totalSegments > 1
                ? `Uploading part ${segmentNumber} of ${totalSegments}...`
                : 'Uploading video...'
              );
              const uploadRes = await uploadService.uploadSingle(uploadFile, 'statuses', {
                onProgress: (pct) => {
                  const progress = 70 + (((segment.index + (pct / 100)) / totalSegments) * 25);
                  setUploadProgress(Math.min(95, Math.round(progress)));
                },
              });
              if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
              segmentUrl = uploadRes.data.url;
              thumbnailSource = uploadFile;
            }

            setUploadPhase(totalSegments > 1
              ? `Creating preview ${segmentNumber} of ${totalSegments}...`
              : 'Creating video preview...'
            );
            const thumbnailFile = await generateVideoThumbnail(thumbnailSource);
            let segmentThumbnailUrl = '';
            if (thumbnailFile) {
              const thumbnailRes = await uploadService.uploadSingle(thumbnailFile, 'statuses');
              if (thumbnailRes.success) segmentThumbnailUrl = thumbnailRes.data.url;
            }

            setUploadPhase(totalSegments > 1
              ? `Publishing part ${segmentNumber} of ${totalSegments}...`
              : 'Publishing story...'
            );
            await publishStatus(createStatusPayload({
              content_url: segmentUrl,
              thumbnail_url: segmentThumbnailUrl,
            }));
          }
        } else {
          setUploadPhase('Uploading image...');
          const uploadRes = await uploadService.uploadSingle(file, 'statuses', {
            onProgress: (pct) => setUploadProgress(pct),
          });
          if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
          finalUrl = uploadRes.data.url;
          setUploadPhase('Publishing story...');
          await publishStatus(createStatusPayload());
        }
      } else if (type !== 'text' && !isReshare && !previewUrl && !file) {
        console.error('[StatusCreator] Error condition met: no file', {
          type,
          isReshare,
          previewUrl,
          file: !!file,
        });
        throw new Error('Please select a file to upload');
      } else if (type !== 'text' && !previewUrl && !file) {
        console.error('[StatusCreator] Error condition met: media not ready', {
          type,
          previewUrl,
          file: !!file,
        });
        // Video/image selected but not ready yet or upload didn't complete
        throw new Error('Unable to prepare media. Please try again');
      } else {
        console.log('[StatusCreator] Publishing status without media');
        await publishStatus(createStatusPayload());
      }

      if (createdStatuses.length) {
        clearSelectedMedia();
        onStatusCreated?.(createdStatuses.length === 1 ? createdStatuses[0] : createdStatuses);
        onClose();
      }
    } catch (err) {
      console.error('[StatusCreator] handlePost error caught:', {
        errorName: err.name,
        errorMessage: err.message,
        isNetworkError: !err.response && err.code,
        statusCode: err.response?.status,
        responseData: err.response?.data,
        errorStack: err.stack?.split('\n').slice(0, 3).join('\n'),
      });
      
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to post story';
      setError(msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setUploadPhase('');
    }
  };

  const startDrag = (event, handle) => {
    event.stopPropagation();
    const track = trimmerTrackRef.current;
    if (!track || !videoMeta?.duration) return;

    // WhatsApp mechanic: pause video when dragging starts
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
    }

    const getClientX = (e) => {
      if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
      return e.clientX;
    };

    const rect = track.getBoundingClientRect();
    const duration = videoMeta.duration;

    const onDrag = (moveEvent) => {
      const currentX = getClientX(moveEvent);
      const offsetPct = (currentX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, offsetPct * duration));

      if (handle === 'start') {
        const minStart = Math.max(0, trimEndRef.current - STATUS_VIDEO_MAX_SECONDS);
        const nextStart = Math.max(minStart, Math.min(newTime, trimEndRef.current - 0.5));
        setTrimStart(nextStart);
        setVideoPostMode('trim');
        // WhatsApp Mechanic: jump to current frame on drag
        if (previewVideoRef.current) {
          previewVideoRef.current.currentTime = nextStart;
        }
      } else {
        const maxEnd = Math.min(duration, trimStartRef.current + STATUS_VIDEO_MAX_SECONDS);
        const nextEnd = Math.max(trimStartRef.current + 0.5, Math.min(newTime, maxEnd));
        setTrimEnd(nextEnd);
        setVideoPostMode('trim');
        // WhatsApp Mechanic: jump to current frame on drag
        if (previewVideoRef.current) {
          previewVideoRef.current.currentTime = nextEnd;
        }
      }
    };

    const endDrag = () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', endDrag);

      // WhatsApp mechanic: play video from trimStart when dragging ends
      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = trimStartRef.current;
        previewVideoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onDrag);
    window.addEventListener('touchend', endDrag);
  };

  // Drag the entire selection window left/right (pan the clip)
  const startDragSelection = (event) => {
    event.stopPropagation();
    const track = trimmerTrackRef.current;
    if (!track || !videoMeta?.duration) return;

    if (previewVideoRef.current) previewVideoRef.current.pause();

    const getClientX = (e) => {
      if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
      return e.clientX;
    };

    const rect = track.getBoundingClientRect();
    const duration = videoMeta.duration;
    const clipLen = trimEndRef.current - trimStartRef.current;
    let startX = getClientX(event);

    const onDrag = (moveEvent) => {
      moveEvent.preventDefault();
      const dx = getClientX(moveEvent) - startX;
      startX = getClientX(moveEvent);
      const dtSec = (dx / rect.width) * duration;

      const curStart = trimStartRef.current;
      const curEnd = trimEndRef.current;
      let nextStart = curStart + dtSec;
      let nextEnd = curEnd + dtSec;

      // Clamp to video bounds
      if (nextStart < 0) { nextStart = 0; nextEnd = clipLen; }
      if (nextEnd > duration) { nextEnd = duration; nextStart = duration - clipLen; }

      setTrimStart(nextStart);
      setTrimEnd(nextEnd);
      setVideoPostMode('trim');

      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = nextStart;
      }
    };

    const endDrag = () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', endDrag);

      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = trimStartRef.current;
        previewVideoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
  };

  const handleTrackClick = (e) => {
    if (!trimmerTrackRef.current || !videoMeta?.duration) return;
    const rect = trimmerTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const clickTime = pct * videoMeta.duration;

    const video = previewVideoRef.current;
    if (video) {
      video.currentTime = Math.max(trimStart, Math.min(trimEnd, clickTime));
      setCurrentTime(video.currentTime);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canPost = selectedCategory && (type === 'text' ? textContent.trim() : (file || (isReshare && previewUrl)));
  const videoSegments = useMemo(
    () => buildVideoSegments(videoMeta?.duration || 0),
    [videoMeta?.duration]
  );
  const isLongVideo = type === 'video' && file && videoMeta?.duration > STATUS_VIDEO_MAX_SECONDS + 0.5;
  const selectedClipLabel = `${formatSeconds(trimStart)} - ${formatSeconds(trimEnd)}`;
  const selectedLength = Math.max(0.1, trimEnd - trimStart);
  const maxClip = STATUS_VIDEO_MAX_SECONDS;

  const previewFitClass = cropMode === 'crop' ? 'object-cover' : 'object-contain';

  if (!mounted) return null;

  const previewVideoSrc = buildPreviewVideoSrc(previewUrl);

  const layout = (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden font-[Poppins]">
      <style>{`
        .status-preview-video {
          -webkit-appearance: none;
          appearance: none;
        }
        .status-preview-video::-webkit-media-controls,
        .status-preview-video::-webkit-media-controls-enclosure,
        .status-preview-video::-webkit-media-controls-panel,
        .status-preview-video::-webkit-media-controls-start-playback-button,
        .status-preview-video::-webkit-media-controls-overlay-play-button,
        .status-preview-video::-webkit-media-controls-play-button {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
      {/* Blurred background showing status contents (premium gradient/image blur) */}
      {previewUrl && (
        <div 
          className="absolute inset-0 z-0 opacity-20 blur-3xl scale-125 transition-all duration-500 pointer-events-none"
          style={type === 'text' ? TEXT_GRADIENTS[gradientIndex].style : { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* Central Phone Mockup Container */}
      <div className="relative z-10 w-full md:w-[428px] h-full md:h-[90vh] md:max-h-[760px] md:aspect-[9/16] md:rounded-[2.5rem] md:border-8 md:border-[#202022] md:shadow-2xl bg-black overflow-hidden flex flex-col">
        
        {/* Top Status Bar Mockup (Only on desktop frames for premium detail) */}
        <div className="hidden md:flex justify-between items-center px-6 py-2.5 bg-black/45 text-white/50 text-[10px] font-bold select-none shrink-0 z-30">
          <span>12:45 PM</span>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-white/50" />
            <span className="w-4 h-2 border border-white/50 rounded-sm relative flex items-center p-0.5">
              <span className="h-full w-2.5 bg-white/70" />
            </span>
          </div>
        </div>

        {/* Header / Top Tool Bar */}
        <header className="p-4 flex items-center justify-between bg-black/45 backdrop-blur-sm z-30 border-b border-white/5 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-colors" 
            aria-label="Close editor"
          >
            <X className="size-5.5" />
          </button>
          
          <div className="flex items-center gap-1">
            {type === 'text' ? (
              <>
                <button
                  type="button"
                  onClick={() => setFontFamilyIndex(prev => (prev + 1) % TEXT_FONTS.length)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                  title="Change Font Style"
                >
                  <Type className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setGradientIndex(prev => (prev + 1) % TEXT_GRADIENTS.length)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                  title="Change Gradient"
                >
                  <Palette className="size-5" />
                </button>
              </>
            ) : previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={clearSelectedMedia}
                  className="p-2 rounded-full hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove Media"
                >
                  <Trash2 className="size-5" />
                </button>
                {type === 'video' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMuted(prev => !prev)}
                      className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                      title={muted ? "Unmute Preview" : "Mute Preview"}
                    >
                      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTrimmer(prev => !prev)}
                      className={`p-2 rounded-full hover:bg-white/10 transition-colors ${showTrimmer ? 'text-[#20c763]' : 'text-white'}`}
                      title="Trim Video"
                    >
                      <Scissors className="size-5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setCropMode(prev => prev === 'crop' ? 'fit' : 'crop')}
                  className={`p-2 rounded-full hover:bg-white/10 transition-colors ${cropMode === 'crop' ? 'text-[#20c763]' : 'text-white'}`}
                  title={cropMode === 'crop' ? "Fit Full View" : "Crop to 9:16"}
                >
                  <Crop className="size-5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setType('image'); clearSelectedMedia(); }}
                  className={`p-2 rounded-full transition-colors ${type === 'image' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Photo Mode"
                >
                  <ImageIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setType('video'); clearSelectedMedia(); }}
                  className={`p-2 rounded-full transition-colors ${type === 'video' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Video Mode"
                >
                  <Video className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setType('text'); clearSelectedMedia(); }}
                  className={`p-2 rounded-full transition-colors ${type === 'text' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Text Mode"
                >
                  <Type className="size-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Central Workspace / Media Preview Container */}
        <div className="flex-1 relative bg-[#09090b] flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
              {type === 'video' ? (
                <>
                  <video
                    ref={previewVideoRef}
                    src={previewVideoSrc}
                    className={`status-preview-video absolute inset-0 w-full h-full ${previewFitClass} z-10 pointer-events-none`}
                    autoPlay
                    muted={muted}
                    loop
                    playsInline
                    controls={false}
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
                    preload="auto"
                    onContextMenu={(e) => e.preventDefault()}
                    onLoadedMetadata={(e) => {
                      if (!isNativePlatform()) return;
                      // Seek to 0.001s the instant metadata is known (readyState=1).
                      // Primes the HW decoder pipeline before play() is attempted,
                      // showing the first frame even if play() is later rejected.
                      e.currentTarget.currentTime = 0.001;
                    }}
                    onCanPlay={(e) => {
                      const v = e.currentTarget;
                      if (isNativePlatform() && v.paused) v.play().catch(() => {});
                    }}
                    onLoadedData={(e) => {
                      const v = e.currentTarget;
                      if (v.readyState >= 2 && v.paused) v.play().catch(() => {});
                    }}
                    onError={(e) => {
                      const v = e.currentTarget;
                      if (previewUrl && v.src !== previewUrl && !v.dataset.retriedPlainSrc) {
                        v.dataset.retriedPlainSrc = '1';
                        v.src = previewUrl;
                        v.load();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="absolute bottom-4 right-4 z-30 flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/70"
                    aria-label={isPlaying ? 'Pause video preview' : 'Play video preview'}
                  >
                    {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                  </button>
                </>
              ) : (
                <img
                  src={previewUrl}
                  className={`w-full h-full ${previewFitClass} z-10`}
                  alt="status preview"
                />
              )}
              {/* Overlay shadow gradients to keep inputs/headers legible */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 z-20 pointer-events-none" />
              
              {/* Floating Product Tag (If tagged) */}
              {linkedProduct && (
                <div className={`absolute left-4 right-4 z-20 p-2.5 rounded-2xl border border-[#20c763]/25 bg-black/75 backdrop-blur-md flex items-center justify-between min-w-0 shadow-xl transition-all duration-300 ${
                  (type === 'video' && showTrimmer && videoMeta) ? 'top-[96px]' : 'top-4'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0">
                      <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{linkedProduct.name}</p>
                      <p className="text-[10px] font-black text-[#20c763] mt-0.5">{linkedProduct.price?.toLocaleString()} XAF</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLinkedProduct(null)} 
                    className="size-7 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* WhatsApp-Style top filmstrip trimmer timeline (Video only, overlaying at the top of the video preview screen) */}
              {type === 'video' && videoMeta && previewUrl && showTrimmer && (
                <div className="absolute top-4 left-4 right-4 z-30 select-none bg-black/60 p-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-white/60 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Scissors className="size-3 text-[#20c763]" />
                      <span>Trim Clip: {formatSeconds(trimStart)} - {formatSeconds(trimEnd)}</span>
                    </span>
                    <span>{selectedLength.toFixed(1)}s / {maxClip}s</span>
                  </div>
                  
                  {/* filmstrip track */}
                  <div 
                    ref={trimmerTrackRef}
                    onClick={handleTrackClick}
                    className="relative h-12 flex items-center cursor-pointer rounded-lg overflow-hidden border border-white/20 bg-black/40"
                  >
                    {/* Thumbnail Frames Row — full opacity so filmstrip is clearly visible */}
                    <div className="absolute inset-0 flex overflow-hidden rounded-lg pointer-events-none">
                      {timelineFrames.length > 0 ? (
                        timelineFrames.map((src, i) => (
                          <img key={i} src={src} className="flex-1 h-full object-cover" alt="" />
                        ))
                      ) : (
                        <div className="w-full h-full flex items-center justify-center gap-0.5">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex-1 h-full bg-gradient-to-b from-neutral-700 to-neutral-800 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Darkened mask: Left of selection */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-black/70 z-10 pointer-events-none border-y border-transparent"
                      style={{ width: `${(trimStart / (videoMeta?.duration || 1)) * 100}%` }}
                    />
                    
                    {/* Darkened mask: Right of selection */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-black/70 z-10 pointer-events-none border-y border-transparent"
                      style={{ width: `${100 - (trimEnd / (videoMeta?.duration || 1)) * 100}%` }}
                    />

                    {/* Bright selection window — draggable to move the entire clip */}
                    <div 
                      className="absolute top-0 bottom-0 border-y-2 border-x-2 border-[#20c763] z-10 cursor-grab active:cursor-grabbing"
                      style={{
                        left: `${(trimStart / (videoMeta?.duration || 1)) * 100}%`,
                        right: `${100 - (trimEnd / (videoMeta?.duration || 1)) * 100}%`
                      }}
                      onMouseDown={(e) => startDragSelection(e)}
                      onTouchStart={(e) => startDragSelection(e)}
                    />
                    
                    {/* Playhead line */}
                    <div 
                      className="absolute h-full w-0.5 bg-white z-15 pointer-events-none shadow"
                      style={{ left: `${(currentTime / (videoMeta?.duration || 1)) * 100}%` }}
                    />
                    
                    {/* Left bracket handle */}
                    <div 
                      className="absolute top-0 bottom-0 w-3 bg-[#20c763] cursor-ew-resize z-20 flex items-center justify-center rounded-l-md shadow-md border-r border-white/20 hover:brightness-110 active:scale-y-95 transition-all"
                      style={{ left: `${(trimStart / (videoMeta?.duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => startDrag(e, 'start')}
                      onTouchStart={(e) => startDrag(e, 'start')}
                    >
                      <div className="w-0.5 h-4 bg-white/70 rounded-full" />
                    </div>
                    
                    {/* Right bracket handle */}
                    <div 
                      className="absolute top-0 bottom-0 w-3 bg-[#20c763] cursor-ew-resize z-20 flex items-center justify-center rounded-r-md shadow-md border-l border-white/20 hover:brightness-110 active:scale-y-95 transition-all"
                      style={{ left: `${(trimEnd / (videoMeta?.duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => startDrag(e, 'end')}
                      onTouchStart={(e) => startDrag(e, 'end')}
                    >
                      <div className="w-0.5 h-4 bg-white/70 rounded-full" />
                    </div>


                  </div>
                </div>
              )}
            </div>
          ) : type === 'text' ? (
            <div 
              className="absolute inset-0 flex flex-col justify-center items-center p-6 text-center select-none transition-all duration-300"
              style={TEXT_GRADIENTS[gradientIndex].style}
            >
              <textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Type a status"
                className={`w-full max-h-[50%] resize-none bg-transparent text-center text-2xl md:text-3xl leading-relaxed text-white outline-none placeholder:text-white/30 border-0 focus:ring-0 focus:border-0 ${TEXT_FONTS[fontFamilyIndex].className}`}
                maxLength={300}
              />
              <span className="text-[10px] font-bold tracking-wider text-white/40 font-mono mt-4">
                {textContent.length} / 300
              </span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
              <div className="size-16 rounded-3xl bg-gradient-to-br from-[#20c763]/20 to-[#00a884]/5 flex items-center justify-center text-[#20c763] border border-[#20c763]/25 shadow-lg shadow-[#20c763]/5">
                {type === 'image' ? <ImageIcon className="size-8" /> : <Video className="size-8" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create a {type === 'image' ? 'photo' : 'video'} status</h3>
                <p className="text-xs text-white/55 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Choose a local {type === 'image' ? 'image' : 'video file'} to edit and share with your audience
                </p>
              </div>
              
              <div className="w-full max-w-[240px] space-y-2">
                <button 
                  type="button" 
                  onClick={() => {
                    if (type === 'image') imageInputRef.current?.click();
                    else videoInputRef.current?.click();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-[#00a884] text-black text-xs font-black uppercase tracking-wider shadow-lg active:scale-98 transition-all hover:brightness-105"
                >
                  Choose {type === 'image' ? 'Photo' : 'Video'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => {
                    setType('text');
                    clearSelectedMedia();
                  }}
                  className="w-full py-3 px-4 rounded-2xl border border-white/10 bg-white/5 text-white text-xs font-bold transition-all hover:bg-white/10"
                >
                  Or type text status
                </button>
              </div>
              
              <input 
                ref={imageInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'image')} 
              />
              <input 
                ref={videoInputRef} 
                type="file" 
                accept="video/*" 
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'video')} 
              />
            </div>
          )}

          {/* Inline Product Picker Sheet inside Mockup */}
          <AnimatePresence>
            {showProductPicker && (
              <>
                <div className="absolute inset-0 bg-black/55 z-40" onClick={() => setShowProductPicker(false)} />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                  className="absolute inset-x-0 bottom-0 z-50 bg-[#121214] border-t border-white/10 rounded-t-[2rem] p-4 max-h-[60%] flex flex-col"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <p className="text-[9px] font-bold text-[#20c763] uppercase tracking-wider">AuraMarket Catalog</p>
                      <h3 className="text-xs font-bold text-white mt-0.5">Tag a Product</h3>
                    </div>
                    <button type="button" onClick={() => setShowProductPicker(false)} className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center">
                      <X className="size-4" />
                    </button>
                  </div>
                  
                  <div className="mt-3 flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar text-white">
                    {linkedProduct ? (
                      <div className="p-3 rounded-2xl border border-[#20c763]/30 bg-[#20c763]/5 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0">
                            <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{linkedProduct.name}</p>
                            <p className="text-[10px] font-black text-[#20c763] mt-0.5">{linkedProduct.price?.toLocaleString()} XAF</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setLinkedProduct(null)} className="size-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-colors shrink-0">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search your products..."
                            className="h-10 w-full rounded-2xl border border-white/10 bg-white/8 pl-10 pr-4 text-xs font-semibold text-white outline-none focus:border-[#20c763] transition-all"
                          />
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
                          {filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => { setLinkedProduct(p); setSearchTerm(''); setShowProductPicker(false); }}
                              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all text-left"
                            >
                              <div className="size-9 rounded-lg overflow-hidden border border-white/10 bg-black shrink-0">
                                <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-full object-cover" alt="" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{p.name}</p>
                                <p className="text-[10px] font-black text-[#20c763] mt-0.5">{p.price?.toLocaleString()} XAF</p>
                              </div>
                            </button>
                          )) : (
                            <div className="p-6 text-center text-xs font-bold text-white/30">No products found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Inline Settings Picker Sheet inside Mockup */}
          <AnimatePresence>
            {showSettingsPicker && (
              <>
                <div className="absolute inset-0 bg-black/55 z-40" onClick={() => setShowSettingsPicker(false)} />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                  className="absolute inset-x-0 bottom-0 z-50 bg-[#121214] border-t border-white/10 rounded-t-[2rem] p-4 max-h-[70%] flex flex-col no-scrollbar text-white"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <p className="text-[9px] font-bold text-[#20c763] uppercase tracking-wider">Configure Story</p>
                      <h3 className="text-xs font-bold text-white mt-0.5">Status Details</h3>
                    </div>
                    <button type="button" onClick={() => setShowSettingsPicker(false)} className="size-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center">
                      <X className="size-4" />
                    </button>
                  </div>
                  
                  <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
                    {/* Duration Select */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-white/40">Story Duration</label>
                      <div className="grid grid-cols-3 gap-2">
                        {DURATION_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setExpiryDays(opt.value)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              expiryDays === opt.value
                                ? 'border-[#20c763] bg-[#20c763]/10 text-white shadow-md shadow-[#20c763]/5'
                                : 'border-white/5 bg-white/5 text-white/60 hover:border-white/10'
                            }`}
                          >
                            <p className="text-xs font-bold">{opt.label}</p>
                            <p className="text-[8px] opacity-50 mt-0.5 leading-none">{opt.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category Select */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-white/40">Category</label>
                      <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                        {STATUS_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`py-2 px-1 rounded-xl border text-center text-[10px] font-bold transition-all truncate ${
                              selectedCategory === cat
                                ? 'border-[#20c763] bg-[#20c763] text-black'
                                : 'border-white/5 bg-white/5 text-white/60 hover:border-white/10'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Long Video options (Split/Trim) */}
                    {isLongVideo && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-white/40">Splitting Options</label>
                        <div className="grid grid-cols-2 gap-2">
                          {VIDEO_POST_MODES.map((mode) => {
                            const Icon = mode.icon;
                            const active = videoPostMode === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setVideoPostMode(mode.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                  active
                                    ? 'border-[#20c763] bg-[#20c763]/10 text-white'
                                    : 'border-white/5 bg-white/5 text-white/60 hover:border-white/10'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 text-xs font-bold">
                                  <Icon className="size-3.5 text-[#20c763]" />
                                  {mode.label}
                                </span>
                                <span className="mt-0.5 block text-[8px] opacity-50">
                                  {mode.id === 'split' ? `${videoSegments.length} parts` : selectedClipLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Full Screen Loading Overlay inside Mockup */}
          {loading && uploadPhase && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="size-10 text-[#20c763] animate-spin mb-4" />
              <p className="text-xs font-bold text-white tracking-wide uppercase mb-2">{uploadPhase}</p>
              {uploadProgress > 0 && (
                <div className="w-full max-w-[200px]">
                  <div className="flex justify-between text-[9px] font-bold text-white/50 mb-1">
                    <span>Uploading</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#20c763] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Tool Bar / Input Capsule */}
        <div className="p-4 flex items-center gap-3 bg-black/45 backdrop-blur-sm z-30 shrink-0">
          {type === 'text' ? (
            <>
              {/* Text Mode Bottom bar */}
              <button 
                type="button" 
                onClick={() => setShowSettingsPicker(true)} 
                className="flex items-center gap-1.5 rounded-full bg-[#1f2c34] px-4 py-2.5 border border-white/5 text-xs text-white/80 hover:bg-[#2a3942] transition-colors"
              >
                <Sliders className="size-3.5 text-[#20c763]" />
                <span>{selectedCategory} · {expiryDays}d</span>
              </button>
              
              <button 
                type="button" 
                onClick={() => setShowProductPicker(true)} 
                className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 border text-xs transition-colors ${
                  linkedProduct 
                    ? 'bg-[#20c763]/10 border-[#20c763]/30 text-[#20c763]' 
                    : 'bg-[#1f2c34] border-white/5 text-white/80 hover:bg-[#2a3942]'
                }`}
              >
                <Tag className="size-3.5" />
                <span>{linkedProduct ? 'Product Tagged' : 'Tag Product'}</span>
              </button>

              <button 
                type="button" 
                onClick={handlePost} 
                disabled={loading || !canPost} 
                className="ml-auto size-11 rounded-full bg-[#00a884] text-black flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40"
                aria-label="Send status"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 ml-0.5 fill-black" />}
              </button>
            </>
          ) : (
            <>
              {/* Media Mode Bottom bar (WhatsApp rounded Capsule) */}
              <div className="flex-1 flex items-center bg-[#1f2c34] border border-white/5 rounded-full px-3 py-1.5 min-w-0">
                <button 
                  type="button" 
                  onClick={() => setShowProductPicker(true)} 
                  className={`p-1.5 rounded-full hover:bg-white/5 transition-colors shrink-0 ${linkedProduct ? 'text-[#20c763]' : 'text-white/60'}`}
                  title="Tag Product"
                >
                  <Tag className="size-5" />
                </button>
                
                <input 
                  ref={captionInputRef} 
                  value={caption} 
                  onChange={e => setCaption(e.target.value.slice(0, 150))} 
                  placeholder="Add a caption..." 
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/40 focus:ring-0 px-2 py-1" 
                />
                
                <button 
                  type="button" 
                  onClick={() => setShowSettingsPicker(true)} 
                  className="p-1.5 rounded-full hover:bg-white/5 text-white/60 transition-colors shrink-0"
                  title="Status Settings"
                >
                  <Sliders className="size-5" />
                </button>
              </div>

              <button 
                type="button" 
                onClick={handlePost} 
                disabled={loading || !canPost} 
                className="size-11 rounded-full bg-[#00a884] text-black flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-40 shrink-0"
                aria-label="Send status"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 ml-0.5 fill-black" />}
              </button>
            </>
          )}
        </div>

        {/* Display Error bar if exists */}
        {error && (
          <div className="absolute top-16 left-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 shadow-lg shrink-0">
            <AlertCircle className="size-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    layout,
    document.body
  );
}