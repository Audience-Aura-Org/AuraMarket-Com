"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Clock, Search, Edit2, ChevronDown
} from 'lucide-react';
import { uploadService } from '@/services/upload';
import api from '@/services/api';
import { STATUS_CATEGORIES } from '@/constants/statusCategories';
import {
  STATUS_VIDEO_MAX_BYTES,
  STATUS_VIDEO_INPUT_MAX_BYTES,
  STATUS_IMAGE_MAX_BYTES,
  STATUS_VIDEO_MAX_SECONDS,
  STATUS_VIDEO_EXPORT_WIDTH,
  STATUS_VIDEO_EXPORT_HEIGHT,
} from '@/constants/statusVideo';
import StatusVideoTrimmer from '@/components/status/StatusVideoTrimmer';

const DURATION_OPTIONS = [
  { value: 1, label: '1 Day' },
  { value: 3, label: '3 Days', recommended: true },
  { value: 7, label: '7 Days' },
];

const getSupportedVideoMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.78) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const waitForVideoMetadata = (video, { timeout = 5000, rejectOnError = false } = {}) => (
  new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.oncanplay = null;
      video.ondurationchange = null;
      video.onerror = null;
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = () => {
      if (settled) return;
      if (video.videoWidth || Number.isFinite(video.duration) || !rejectOnError) {
        finish();
        return;
      }
      settled = true;
      cleanup();
      reject(new Error('Could not read video metadata.'));
    };

    video.onloadedmetadata = finish;
    video.onloadeddata = finish;
    video.oncanplay = finish;
    video.ondurationchange = finish;
    video.onerror = fail;
    setTimeout(fail, timeout);
  })
);

async function generateVideoThumbnail(file) {
  if (!file?.type?.startsWith('video/')) return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  
  // ── CRITICAL for Android WebView ────────────────────────────────────────
  // The video element MUST be appended to the DOM and have a real, visible size (at least 160×90).
  // We position it on-screen at opacity 0.002 so it's technically visible
  // to the compositor but completely unnoticeable to the user.
  video.style.position = 'fixed';
  video.style.top = '0px';
  video.style.left = '0px';
  video.style.width = '160px';
  video.style.height = '90px';
  video.style.opacity = '0.002';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '9999';
  document.body.appendChild(video);

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await waitForVideoMetadata(video);

    const seekTo = Math.min(1, Math.max(0.1, (video.duration || 1) * 0.1));
    await new Promise((resolve) => {
      video.onseeked = resolve;
      video.currentTime = seekTo;
    });

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.78);
    if (!blob) return null;

    const baseName = (file.name || 'status-video').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}-poster.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
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
  // The video element MUST be appended to the DOM and have a real, visible size (at least 160×90).
  // We position it on-screen at opacity 0.002 so it's technically visible
  // to the compositor but completely unnoticeable to the user.
  video.style.position = 'fixed';
  video.style.top = '0px';
  video.style.left = '0px';
  video.style.width = '160px';
  video.style.height = '90px';
  video.style.opacity = '0.002';
  video.style.pointerEvents = 'none';
  video.style.zIndex = '9999';
  document.body.appendChild(video);

  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await waitForVideoMetadata(video);

    return {
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : STATUS_VIDEO_MAX_SECONDS,
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
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

function drawVideoFrame(ctx, video) {
  const canvas = ctx.canvas;
  const sourceWidth = video.videoWidth || canvas.width;
  const sourceHeight = video.videoHeight || canvas.height;
  const targetRatio = canvas.width / canvas.height;
  const sourceRatio = sourceWidth / sourceHeight;

  ctx.fillStyle = '#07030a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

async function exportEditedStatusVideo(file, { trimStart = 0, trimEnd = STATUS_VIDEO_MAX_SECONDS, onProgress } = {}) {
  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) {
    throw new Error('Video editing is not supported on this browser. Please trim the video in your gallery and try again.');
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = false;
  video.playsInline = true;
  video.preload = 'auto';
  if (sourceUrl && !sourceUrl.startsWith('blob:')) {
    video.crossOrigin = 'anonymous';
  }

  try {
    await waitForVideoMetadata(video, { rejectOnError: true });

    const start = Math.max(0, Math.min(trimStart, video.duration || 0));
    const end = Math.min(Math.max(start + 1, trimEnd), video.duration || start + STATUS_VIDEO_MAX_SECONDS);
    const duration = Math.min(STATUS_VIDEO_MAX_SECONDS, end - start);

    const canvas = document.createElement('canvas');
    canvas.width = STATUS_VIDEO_EXPORT_WIDTH;
    canvas.height = STATUS_VIDEO_EXPORT_HEIGHT;
    const ctx = canvas.getContext('2d');
    const canvasStream = canvas.captureStream(30);
    const sourceStream = video.captureStream?.();
    sourceStream?.getAudioTracks?.().forEach((track) => canvasStream.addTrack(track));

    const chunks = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 96_000,
    });

    const recorded = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('Video export failed.'));
      recorder.onstop = resolve;
    });

    await new Promise((resolve) => {
      video.onseeked = resolve;
      video.currentTime = start;
    });

    let stopped = false;
    const draw = () => {
      if (stopped) return;
      drawVideoFrame(ctx, video);
      const elapsed = Math.max(0, video.currentTime - start);
      onProgress?.(Math.min(95, Math.round((elapsed / Math.max(duration, 1)) * 95)));
      if (elapsed >= duration || video.ended) {
        stopped = true;
        video.pause();
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      requestAnimationFrame(draw);
    };

    recorder.start(500);
    await video.play();
    draw();
    await recorded;

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' });
    const baseName = (file.name || 'status-video').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}-story.webm`, {
      type: blob.type || 'video/webm',
      lastModified: Date.now(),
    });
  } finally {
    video.pause();
    URL.revokeObjectURL(sourceUrl);
  }
}

const DEVICE_TYPE = () => {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
};

/**
 * StatusCreator - WhatsApp-style story creator
 * Fully responsive: mobile, tablet, desktop
 */
export default function StatusCreator({ onClose, onStatusCreated, initialData = null }) {
  const isReshare = !!initialData;
  const [deviceType, setDeviceType] = useState('desktop');

  const [type, setType] = useState(initialData?.type || 'image');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initialData?.content_url || '');
  const [textContent, setTextContent] = useState(initialData?.text_content || '');
  const [caption, setCaption] = useState(initialData?.caption || '');
  const [linkedProduct, setLinkedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const [error, setError] = useState(null);
  const [expiryDays, setExpiryDays] = useState(initialData?.expiry_days || 3);
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || null);
  const [mounted, setMounted] = useState(false);
  const [videoMeta, setVideoMeta] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(STATUS_VIDEO_MAX_SECONDS);
  const [showDetails, setShowDetails] = useState(false);

  const fileInputRef = useRef(null);

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

  // Load products
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
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl && file) URL.revokeObjectURL(previewUrl);

    if (type === 'video') {
      if (!f.type.startsWith('video/')) { setError('Select a video file.'); return; }
      if (f.size > STATUS_VIDEO_INPUT_MAX_BYTES) { setError('Max 500MB source video.'); return; }

      try {
        const meta = await readVideoMetadata(f);
        if (meta.objectUrl) URL.revokeObjectURL(meta.objectUrl);
        const needsTrim = meta.duration > STATUS_VIDEO_MAX_SECONDS + 0.5;
        setVideoMeta({ ...meta, needsTrim });
        setTrimStart(0);
        setTrimEnd(Math.min(STATUS_VIDEO_MAX_SECONDS, Math.max(1, meta.duration || STATUS_VIDEO_MAX_SECONDS)));
        setError(needsTrim ? `Trim video to ${STATUS_VIDEO_MAX_SECONDS}s` : null);
      } catch (err) {
        setError(err.message || 'Could not read video metadata.');
        return;
      }
    } else {
      if (!f.type.startsWith('image/')) { setError('Select an image file.'); return; }
      if (f.size > STATUS_IMAGE_MAX_BYTES) { setError('Max 8MB image.'); return; }
      setVideoMeta(null);
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (type !== 'video') setError(null);
  };

  const handlePost = async () => {
    if (!selectedCategory) { setError('Please select a category.'); return; }
    setLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    setError(null);

    try {
      let finalUrl = previewUrl;
      let thumbnailUrl = initialData?.thumbnail_url || '';

      if (type !== 'text' && file) {
        let uploadFile = file;
        if (file.type.startsWith('video/')) {
          const clipLength = trimEnd - trimStart;
          if (clipLength > STATUS_VIDEO_MAX_SECONDS + 0.5) {
            throw new Error(`Story clips must be ${STATUS_VIDEO_MAX_SECONDS}s or less.`);
          }

          setUploadPhase('Preparing video...');
          uploadFile = await exportEditedStatusVideo(file, {
            trimStart,
            trimEnd,
            onProgress: (pct) => setUploadProgress(Math.min(70, pct)),
          });
          if (uploadFile.size > STATUS_VIDEO_MAX_BYTES) {
            throw new Error('Video still too large. Shorten the trim.');
          }
        }

        setUploadPhase('Uploading...');
        const uploadRes = await uploadService.uploadSingle(uploadFile, 'statuses', {
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (!uploadRes.success) throw new Error(uploadRes.message || 'Upload failed');
        finalUrl = uploadRes.data.url;

        if (uploadFile.type.startsWith('video/')) {
          setUploadPhase('Creating preview...');
          const thumbnailFile = await generateVideoThumbnail(uploadFile);
          if (thumbnailFile) {
            const thumbnailRes = await uploadService.uploadSingle(thumbnailFile, 'statuses');
            if (thumbnailRes.success) thumbnailUrl = thumbnailRes.data.url;
          }
        }
      } else if (type !== 'text' && !isReshare && !previewUrl) {
        throw new Error('Please select a file to upload');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const payload = {
        type,
        content_url: type !== 'text' ? finalUrl : '',
        thumbnail_url: type === 'video' ? thumbnailUrl : '',
        text_content: type === 'text' ? textContent : '',
        caption,
        linked_product: linkedProduct?._id || null,
        expires_at: expiresAt.toISOString(),
        expiry_days: expiryDays,
        category: selectedCategory,
      };

      const res = await api.post('/statuses', payload);
      if (res.data.success) {
        onStatusCreated(res.data.data);
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to post story';
      setError(msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setUploadPhase('');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canPost = selectedCategory && (type === 'text' ? textContent.trim() : (file || (isReshare && previewUrl)));

  if (!mounted) return null;

  // MOBILE LAYOUT
  if (deviceType === 'mobile') {
    return createPortal(
      <div className="fixed inset-0 z-[1100] bg-[var(--bg-primary)] flex flex-col">
        {/* Header */}
        <div className="shrink-0 h-16 border-b border-[var(--glass-border)] flex items-center justify-between px-4">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{isReshare ? 'Reshare' : 'New Story'}</h1>
          <button onClick={onClose} className="size-10 rounded-full hover:bg-[var(--bg-secondary)] flex items-center justify-center transition-all">
            <X className="size-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="shrink-0 px-4 py-3 border-b border-[var(--glass-border)] flex gap-2">
          {[
            { id: 'image', label: 'Image', icon: ImageIcon },
            { id: 'video', label: 'Video', icon: Video },
            { id: 'text', label: 'Text', icon: Type },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setType(t.id); if (!isReshare) { setFile(null); setPreviewUrl(''); } setError(null); }}
                className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  type === t.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center px-4 py-4">
          <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            {previewUrl ? (
              <>
                {type === 'video'
                  ? <video src={previewUrl} className="size-full object-cover" autoPlay muted loop playsInline preload="auto" onLoadedData={(e) => { if (e.currentTarget.currentTime < 0.001) e.currentTarget.currentTime = 0.001; }} />
                  : <img src={previewUrl} className="size-full object-cover" alt="" />
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {!isReshare || file ? (
                  <button
                    onClick={() => { setFile(null); setPreviewUrl(''); setError(null); }}
                    className="absolute top-2 right-2 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-all"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <label className="absolute top-2 right-2 size-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-[var(--accent)] transition-all">
                    <input type="file" className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} />
                    <Edit2 className="size-4" />
                  </label>
                )}
              </>
            ) : type === 'text' ? (
              <div className="size-full flex flex-col p-4 bg-gradient-to-br from-[#060606] to-[#180920]">
                <textarea
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent text-xl font-bold text-white text-center outline-none placeholder:text-white/10 resize-none leading-tight"
                  maxLength={300}
                />
                <span className="text-xs font-semibold text-white/20 text-center">{textContent.length}/300</span>
              </div>
            ) : (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
                <div className="size-14 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center">
                  {type === 'image' ? <ImageIcon className="size-6 text-[var(--accent)]" /> : <Video className="size-6 text-[var(--accent)]" />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Upload {type === 'image' ? 'Image' : 'Video'}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Max {type === 'image' ? '8MB' : '500MB'}</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Video Trimmer */}
        {type === 'video' && videoMeta && previewUrl && (
          <div className="shrink-0 px-4 py-3 border-t border-[var(--glass-border)]">
            <StatusVideoTrimmer
              previewUrl={previewUrl}
              duration={videoMeta.duration}
              fileSize={file?.size || 0}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onTrimStartChange={setTrimStart}
              onTrimEndChange={setTrimEnd}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="shrink-0 mx-4 my-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-500 text-xs font-semibold">
            <AlertCircle className="size-3 shrink-0" />
            {error}
          </div>
        )}

        {/* Bottom Section */}
        <div className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-4 space-y-3 max-h-[45%] overflow-y-auto">
          {/* Quick Category Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)]">Category</label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {STATUS_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`py-1.5 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--glass-border)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Expandable Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full h-10 flex items-center justify-between px-3 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg text-xs font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
          >
            <span>More Options</span>
            <ChevronDown className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>

          {/* Details Panel */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 border-t border-[var(--glass-border)]"
              >
                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setExpiryDays(opt.value)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                          expiryDays === opt.value
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--glass-border)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Caption</label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add context..."
                    className="w-full h-16 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg p-2 text-xs font-medium outline-none focus:border-[var(--accent)] resize-none"
                    maxLength={150}
                  />
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-50">{caption.length}/150</span>
                </div>

                {/* Product Tag */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Tag Product</label>
                  {linkedProduct ? (
                    <div className="p-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-8 rounded object-cover shrink-0" alt="" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{linkedProduct.name}</p>
                          <p className="text-[10px] text-[var(--accent)]">{linkedProduct.price?.toLocaleString()} XAF</p>
                        </div>
                      </div>
                      <button onClick={() => setLinkedProduct(null)} className="size-6 rounded flex items-center justify-center hover:bg-red-500/10 text-red-500 shrink-0">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search products..."
                        className="w-full h-9 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg pl-3 text-xs outline-none focus:border-[var(--accent)]"
                      />
                      {searchTerm && filteredProducts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg z-50">
                          {filteredProducts.map(p => (
                            <button
                              key={p._id}
                              onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                              className="w-full p-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)] transition-all text-left border-b border-[var(--glass-border)] last:border-0"
                            >
                              <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-8 rounded object-cover" alt="" />
                              <div>
                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{p.name}</p>
                                <p className="text-[10px] text-[var(--accent)]">{p.price?.toLocaleString()} XAF</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Progress */}
          {loading && uploadPhase && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-[var(--text-secondary)]">
                <span>{uploadPhase}</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${Math.max(uploadProgress, uploadPhase ? 8 : 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Post Button */}
          <button
            onClick={handlePost}
            disabled={loading || !canPost}
            className="w-full h-12 bg-[var(--accent)] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {loading ? 'Publishing...' : (isReshare ? 'Reshare' : 'Publish')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // TABLET & DESKTOP LAYOUT
  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[var(--bg-primary)] rounded-[2rem] border border-white/8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="shrink-0 px-8 py-6 flex items-center justify-between border-b border-[var(--glass-border)]">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{isReshare ? 'Reshare Story' : 'New Story'}</h2>
          </div>
          <button
            onClick={onClose}
            className="size-11 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr] gap-0 h-full">
            {/* Left - Preview */}
            <div className="p-8 border-b md:border-b-0 md:border-r border-[var(--glass-border)] flex flex-col gap-5 overflow-y-auto">
              {/* Type Selector */}
              <div className="flex gap-2">
                {[
                  { id: 'image', label: 'Image' },
                  { id: 'video', label: 'Video' },
                  { id: 'text', label: 'Text' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setType(t.id); if (!isReshare) { setFile(null); setPreviewUrl(''); } setError(null); }}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      type === t.id
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex-1">
                {previewUrl ? (
                  <>
                    {type === 'video'
                      ? <video src={previewUrl} className="size-full object-cover" autoPlay muted loop playsInline preload="auto" onLoadedData={(e) => { if (e.currentTarget.currentTime < 0.001) e.currentTarget.currentTime = 0.001; }} />
                      : <img src={previewUrl} className="size-full object-cover" alt="" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <button
                      onClick={() => { setFile(null); setPreviewUrl(''); setError(null); }}
                      className="absolute top-3 right-3 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-all"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : type === 'text' ? (
                  <div className="size-full flex flex-col p-6 bg-gradient-to-br from-[#060606] to-[#180920]">
                    <textarea
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent text-3xl font-bold text-white text-center outline-none placeholder:text-white/10 resize-none"
                      maxLength={300}
                    />
                    <span className="text-xs text-white/20 text-center">{textContent.length}/300</span>
                  </div>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
                    <div className="size-16 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center">
                      {type === 'image' ? <ImageIcon className="size-7 text-[var(--accent)]" /> : <Video className="size-7 text-[var(--accent)]" />}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[var(--text-primary)]">Upload {type === 'image' ? 'Image' : 'Video'}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Max {type === 'image' ? '8MB' : '500MB'}</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Video Trimmer */}
              {type === 'video' && videoMeta && previewUrl && (
                <div className="space-y-2">
                  <StatusVideoTrimmer
                    previewUrl={previewUrl}
                    duration={videoMeta.duration}
                    fileSize={file?.size || 0}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    onTrimStartChange={setTrimStart}
                    onTrimEndChange={setTrimEnd}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-500 text-xs font-semibold">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Right - Details */}
            <div className="p-8 flex flex-col gap-6 overflow-y-auto">
              {/* Duration */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                  <Clock className="size-4 text-[var(--accent)]" /> Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiryDays(opt.value)}
                      className={`py-3 rounded-lg text-sm font-bold transition-all ${
                        expiryDays === opt.value
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      {opt.label}
                      {opt.recommended && <span className="text-[10px] block">Best</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--text-secondary)]">Category</label>
                  {!selectedCategory && <span className="text-xs text-red-400 font-bold">Required</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === cat
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[var(--text-secondary)]">Caption</label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Add context to your story..."
                  className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg p-3 text-xs font-medium outline-none focus:border-[var(--accent)] resize-none"
                  maxLength={150}
                />
                <span className="text-[10px] text-[var(--text-secondary)] opacity-50 text-right block">{caption.length}/150</span>
              </div>

              {/* Product Tag */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                    <ShoppingBag className="size-4 text-[var(--accent)]" /> Tag Product
                  </label>
                  <span className="text-xs text-[var(--accent)] opacity-70">Optional</span>
                </div>

                {linkedProduct ? (
                  <div className="p-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-10 rounded-lg object-cover" alt="" />
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{linkedProduct.name}</p>
                        <p className="text-[10px] text-[var(--accent)]">{linkedProduct.price?.toLocaleString()} XAF</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkedProduct(null)} className="size-8 rounded flex items-center justify-center hover:bg-red-500/10 text-red-500">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
                      <Search className="size-4" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search your products..."
                      className="w-full h-10 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg pl-9 pr-3 text-xs outline-none focus:border-[var(--accent)]"
                    />
                    {searchTerm && filteredProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg z-50">
                        {filteredProducts.map(p => (
                          <button
                            key={p._id}
                            onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                            className="w-full p-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)] transition-all text-left border-b border-[var(--glass-border)] last:border-0"
                          >
                            <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-8 rounded object-cover" alt="" />
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)] truncate">{p.name}</p>
                              <p className="text-[10px] text-[var(--accent)]">{p.price?.toLocaleString()} XAF</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Upload Progress */}
              {loading && uploadPhase && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-secondary)]">
                    <span>{uploadPhase}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${Math.max(uploadProgress, uploadPhase ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Post Button */}
              <button
                onClick={handlePost}
                disabled={loading || !canPost}
                className="w-full h-12 bg-[var(--accent)] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {loading ? 'Publishing...' : (isReshare ? 'Reshare Story' : 'Publish Story')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
