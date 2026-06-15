"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Clock, Search, RotateCcw,
  Plus, Palette, SplitSquareHorizontal, Scissors
} from 'lucide-react';
import { uploadService } from '@/services/upload';
import api from '@/services/api';
import { STATUS_CATEGORIES } from '@/constants/statusCategories';
import {
  STATUS_VIDEO_INPUT_MAX_BYTES,
  STATUS_IMAGE_MAX_BYTES,
  STATUS_VIDEO_MAX_SECONDS,
  STATUS_VIDEO_MAX_BYTES,
} from '@/constants/statusVideo';
import StatusVideoTrimmer from '@/components/status/StatusVideoTrimmer';

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
  return window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
};

const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.78) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

async function generateVideoThumbnail(file, seekTime = null) {
  if (!file?.type?.startsWith('video/')) return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Could not read video metadata.'));
    });

    const seekTo = Number.isFinite(Number(seekTime))
      ? Math.max(0.1, Math.min(Number(seekTime), Math.max(0.1, (video.duration || 1) - 0.1)))
      : Math.min(1, Math.max(0.1, (video.duration || 1) * 0.1));
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
    URL.revokeObjectURL(objectUrl);
  }
}

async function readVideoMetadata(file) {
  if (!file?.type?.startsWith('video/')) return null;
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Could not read video metadata.'));
    });

    return {
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
      objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
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

export default function StatusCreator({ onClose, onStatusCreated, initialData = null }) {
  const isReshare = !!initialData;

  const [deviceType, setDeviceType] = useState('desktop');
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
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || null);
  const [mounted, setMounted]           = useState(false);
  const [videoMeta, setVideoMeta]       = useState(null);
  const [trimStart, setTrimStart]       = useState(0);
  const [trimEnd, setTrimEnd]           = useState(STATUS_VIDEO_MAX_SECONDS);
  const [videoPostMode, setVideoPostMode] = useState('split');
  const [, setEditingVideo] = useState(false);
  const [gradientIndex, setGradientIndex] = useState(0);

  const fileInputRef = useRef(null);
  const productSearchRef = useRef(null);

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
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (previewUrl && file) URL.revokeObjectURL(previewUrl);

    if (type === 'video') {
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
        setVideoPostMode(needsTrim ? 'split' : 'trim');
        setEditingVideo(true);
        setError(needsTrim
          ? null
          : needsCompression
            ? 'Video will upload once and play only the selected clip.'
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
        const res = await api.post('/statuses', payload);
        if (res.data.success) {
          createdStatuses.push(res.data.data);
        }
      };

      // If resharing image/video and no new file was selected, reuse existing URL
      if (type !== 'text' && file) {
        if (file.type.startsWith('video/')) {
          const segments = videoPostMode === 'split'
            ? buildVideoSegments(videoMeta?.duration || trimEnd)
            : [{ start: trimStart, end: trimEnd, index: 0 }];
          const totalSegments = segments.length;

          setUploadPhase(
            videoPostMode === 'split' && totalSegments > 1
              ? `Uploading video once for ${totalSegments} parts...`
              : 'Uploading video...'
          );
          const uploadRes = await uploadService.uploadSingle(file, 'status-sources', {
            onProgress: (pct) => setUploadProgress(Math.min(82, Math.round(pct * 0.82))),
          });
          if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
          finalUrl = uploadRes.data.url;

          const previewTime = videoPostMode === 'split'
            ? Math.min(segments[0]?.start || 0, Math.max(0, (videoMeta?.duration || 0) - 0.1))
            : Math.min(trimStart, Math.max(0, (videoMeta?.duration || 0) - 0.1));
          setUploadPhase('Creating video preview...');
          const thumbnailFile = await generateVideoThumbnail(file, previewTime);
          if (thumbnailFile) {
            const thumbnailRes = await uploadService.uploadSingle(thumbnailFile, 'statuses');
            if (thumbnailRes.success) thumbnailUrl = thumbnailRes.data.url;
          }

          for (const segment of segments) {
            const segmentNumber = segment.index + 1;
            const clipLength = segment.end - segment.start;
            if (clipLength > STATUS_VIDEO_MAX_SECONDS + 0.5) {
              throw new Error(`Story clips must be ${STATUS_VIDEO_MAX_SECONDS} seconds or less.`);
            }

            setUploadPhase(
              totalSegments > 1
                ? `Publishing part ${segmentNumber} of ${totalSegments}...`
                : 'Publishing story...'
            );
            setUploadProgress(Math.min(99, 84 + Math.round((segmentNumber / totalSegments) * 15)));
            await publishStatus(createStatusPayload({
              content_url: finalUrl,
              thumbnail_url: thumbnailUrl,
              segment_start: segment.start,
              segment_end: segment.end,
              segment_index: segment.index,
              segment_count: totalSegments,
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
      } else if (type !== 'text' && !isReshare && !previewUrl) {
        throw new Error('Please select a file to upload');
      } else {
        await publishStatus(createStatusPayload());
      }

      if (createdStatuses.length) {
        onStatusCreated?.(createdStatuses.length === 1 ? createdStatuses[0] : createdStatuses);
        onClose();
      }
    } catch (err) {
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

  if (!mounted) return null;

  const typeSelector = (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 p-1">
      {[
        { id: 'image', label: 'Image', icon: ImageIcon },
        { id: 'video', label: 'Video', icon: Video },
        { id: 'text', label: 'Text', icon: Type },
      ].map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setType(t.id);
              if (!isReshare) {
                setFile(null);
                setPreviewUrl('');
              }
              setError(null);
            }}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition-all ${
              type === t.id
                ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]/20'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]/55 hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="size-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const previewFrame = (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#09090b] shadow-2xl shadow-black/30">
      {previewUrl ? (
        <>
          {type === 'video' ? (
            <video src={previewUrl} className="absolute inset-0 size-full object-cover" autoPlay muted loop />
          ) : (
            <img src={previewUrl} className="absolute inset-0 size-full object-cover" alt="story preview" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/35" />
          
          <div className="absolute left-4 top-4 z-20 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
            {type}
          </div>

          <div className="absolute right-4 top-4 z-20 flex gap-2">
            {!isReshare || file ? (
              <button
                type="button"
                onClick={() => { setFile(null); setPreviewUrl(''); }}
                className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition-all hover:bg-red-500"
                aria-label="Remove media"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <label className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition-all hover:bg-[var(--accent)]">
                <input type="file" className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} />
                <ImageIcon className="size-4" />
              </label>
            )}
          </div>

          <div className="absolute inset-x-4 bottom-4 z-20">
            <div className="relative flex items-center rounded-2xl border border-white/15 bg-black/60 px-4 py-2.5 backdrop-blur-md">
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 150))}
                placeholder="Add context to your story..."
                className="flex-1 border-none bg-transparent py-1 pr-10 text-xs font-semibold text-white outline-none placeholder:text-white/45"
              />
              <span className="absolute right-3 text-[10px] font-bold tabular-nums text-white/35">
                {caption.length}/150
              </span>
            </div>
          </div>
        </>
      ) : type === 'text' ? (
        <div 
          className="absolute inset-0 flex select-none flex-col justify-between p-6 transition-all duration-300"
          style={TEXT_GRADIENTS[gradientIndex].style}
        >
          <button
            type="button"
            onClick={() => setGradientIndex((prev) => (prev + 1) % TEXT_GRADIENTS.length)}
            className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title="Change background gradient"
          >
            <Palette className="size-4" />
          </button>

          <div className="flex flex-1 items-center justify-center">
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder="Type your message..."
              className="max-h-[70%] w-full resize-none bg-transparent text-center text-xl font-black leading-relaxed text-white outline-none placeholder:text-white/25 md:text-2xl"
              maxLength={300}
            />
          </div>
          <span className="text-center text-[10px] font-black tracking-wider text-white/45">{textContent.length} / 300</span>
        </div>
      ) : (
        <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)] px-6 text-center transition-all hover:border-[var(--accent)]">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
          <div className="flex size-16 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-md transition-transform group-hover:scale-105">
            {type === 'image' ? <ImageIcon className="size-6 text-[var(--accent)]" /> : <Video className="size-6 text-[var(--accent)]" />}
          </div>
          <div>
            <p className="text-sm font-black text-[var(--text-primary)]">Upload {type === 'image' ? 'Image' : 'Video'}</p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--text-secondary)] opacity-70">
              Max {type === 'image' ? '8MB' : '500MB source - optimized to 30s'}
            </p>
          </div>
        </label>
      )}
    </div>
  );

  const videoPostOptions = isLongVideo ? (
    <div className="space-y-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
            Long Video
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
            {formatSeconds(videoMeta.duration)} total - {videoSegments.length} story parts at up to {STATUS_VIDEO_MAX_SECONDS}s each
          </p>
        </div>
        <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-black text-[var(--accent)]">
          WhatsApp-style
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {VIDEO_POST_MODES.map((mode) => {
          const Icon = mode.icon;
          const active = videoPostMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setVideoPostMode(mode.id)}
              className={`rounded-2xl border p-3 text-left transition-all ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                  : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/75 text-[var(--text-secondary)] hover:border-[var(--accent)]/35'
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-black">
                <Icon className="size-4 text-[var(--accent)]" />
                {mode.label}
              </span>
              <span className="mt-1 block text-[10px] font-semibold leading-snug opacity-75">
                {mode.id === 'split' ? `${videoSegments.length} separate updates` : selectedClipLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const metadataOptions = (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          <Clock className="size-3 text-[var(--accent)]" /> Story Duration
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_OPTIONS.map(opt => {
            const active = expiryDays === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExpiryDays(opt.value)}
                className={`relative min-h-[70px] rounded-2xl border p-3 text-left transition-all ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-sm shadow-[var(--accent)]/10'
                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/75 hover:border-[var(--accent)]/35'
                }`}
              >
                {opt.recommended && (
                  <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">
                    Best
                  </span>
                )}
                <div>
                  <p className={`text-xs font-black ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] mt-0.5 leading-none">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={productSearchRef} className="space-y-2.5 scroll-mb-40">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Category</label>
          {!selectedCategory && <span className="text-[10px] font-bold text-red-400">Required</span>}
        </div>
        <div className="grid max-h-[176px] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/55 p-2 no-scrollbar sm:grid-cols-3">
          {STATUS_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-10 rounded-xl border px-2 py-2 text-center text-[11px] font-black leading-tight transition-all ${
                selectedCategory === cat
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                  : 'border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Caption</label>
        <div className="relative">
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add context to your story..."
            className="h-20 w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-3 text-xs font-semibold text-[var(--text-primary)] outline-none transition-all placeholder:opacity-35 focus:border-[var(--accent)]"
            maxLength={150}
          />
          <span className="absolute bottom-2.5 right-3 text-[10px] font-bold tabular-nums opacity-35">{caption.length}/150</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] flex items-center gap-1.5">
            <ShoppingBag className="size-3.5 text-[var(--accent)]" /> Tag Product
          </label>
          <span className="text-[10px] font-semibold text-[var(--accent)] opacity-70">Optional</span>
        </div>

        {linkedProduct ? (
          <div className="p-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl overflow-hidden border border-[var(--glass-border)] shrink-0">
                <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{linkedProduct.name}</p>
                <p className="text-[10px] font-semibold text-[var(--accent)] mt-0.5">{linkedProduct.price?.toLocaleString()} XAF</p>
              </div>
            </div>
            <button type="button" onClick={() => setLinkedProduct(null)} className="size-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30">
                <Search className="size-3.5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => {
                  setTimeout(() => {
                    productSearchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }, 120);
                }}
                placeholder="Search your products..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-9 pr-4 text-xs font-semibold focus:border-[var(--accent)] outline-none transition-all text-[var(--text-primary)]"
              />
              {searchTerm && (
                <div className="relative z-50 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1 shadow-2xl sm:absolute sm:left-0 sm:right-0 sm:top-full sm:mt-1.5 sm:max-h-40">
                  {filteredProducts.length > 0 ? filteredProducts.map(p => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-left"
                    >
                      <div className="size-8 rounded-lg overflow-hidden border border-[var(--glass-border)] shrink-0">
                        <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-full object-cover" alt="" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{p.name}</p>
                        <p className="text-[10px] font-semibold text-[var(--accent)] mt-0.5">{p.price?.toLocaleString()} XAF</p>
                      </div>
                    </button>
                  )) : (
                    <div className="p-4 text-center text-xs opacity-40 font-bold">No products found</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">Can't find your product?</span>
              <a 
                href="/vendor/products/add" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[10px] font-bold text-[var(--accent)] hover:underline flex items-center gap-0.5 transition-all"
              >
                <Plus className="size-3" /> Add new product
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const submitButton = (
    <div className="space-y-3 shrink-0">
      {loading && uploadPhase && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
            <span>{uploadPhase}</span>
            {uploadProgress > 0 && <span className="tabular-nums">{uploadProgress}%</span>}
          </div>
          <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${Math.max(uploadProgress, uploadPhase ? 8 : 0)}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handlePost}
        disabled={loading || !canPost}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Publishing...</span>
          </>
        ) : (
          <>
            <Send className="size-3.5" />
            <span>{isReshare ? 'Reshare Story' : 'Publish Story'}</span>
          </>
        )}
      </button>
    </div>
  );

  const mobileLayout = (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-[var(--bg-primary)]">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--glass-border)] px-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Story Studio</p>
          <h1 className="text-base font-black text-[var(--text-primary)]">
            {isReshare ? 'Reshare Story' : 'New Story'}
          </h1>
        </div>
        <button 
          onClick={onClose} 
          className="flex size-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-secondary)]"
          aria-label="Close story creator"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(11rem+env(safe-area-inset-bottom))] no-scrollbar">
        {typeSelector}
        {previewFrame}
        {videoPostOptions}
        {type === 'video' && videoMeta && previewUrl && (
          <div className="mt-4">
            <StatusVideoTrimmer
              previewUrl={previewUrl}
              duration={videoMeta.duration}
              fileSize={file?.size || 0}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onTrimStartChange={setTrimStart}
              onTrimEndChange={setTrimEnd}
              onEditingChange={setEditingVideo}
            />
          </div>
        )}

        {/* Error messaging */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center gap-3 text-red-500">
            <AlertCircle className="size-4 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 p-4">
          {metadataOptions}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-[var(--glass-border)] bg-[var(--bg-primary)]/92 p-4 backdrop-blur-md">
        {submitButton}
      </div>
    </div>
  );

  const desktopLayout = (
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
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--bg-primary)] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--glass-border)] px-7 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">Story Studio</p>
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              {isReshare ? 'Reshare Story' : 'New Story'}
            </h2>
            {isReshare && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] opacity-80">
                <RotateCcw className="size-3" /> Reusing previous content - replace below if desired
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all hover:bg-red-500/10 hover:text-red-500"
            aria-label="Close story creator"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="grid min-h-full grid-cols-1 gap-0 lg:grid-cols-[380px_1fr]">
            <div className="flex flex-col gap-5 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/18 p-5 md:p-7 lg:border-b-0 lg:border-r">
              {typeSelector}
              
              {previewFrame}

              {error && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/8 p-3 text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-xs font-semibold">{error}</p>
                </div>
              )}
            </div>

            <div className="flex max-h-[76vh] flex-col justify-between gap-6 overflow-y-auto p-5 no-scrollbar md:p-7">
              {videoPostOptions}
              {type === 'video' && videoMeta && previewUrl && (
                <StatusVideoTrimmer
                  previewUrl={previewUrl}
                  duration={videoMeta.duration}
                  fileSize={file?.size || 0}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  onTrimStartChange={setTrimStart}
                  onTrimEndChange={setTrimEnd}
                  onEditingChange={setEditingVideo}
                />
              )}
              {metadataOptions}
              <div className="pt-6 border-t border-[var(--glass-border)]">
                {submitButton}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(
    deviceType === 'mobile' ? mobileLayout : desktopLayout,
    document.body
  );
}
