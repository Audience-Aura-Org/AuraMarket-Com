"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Clock, Search, Tag, RotateCcw,
  Plus, ChevronDown, Edit2, Palette, Volume2, VolumeX
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
  { value: 1, label: '1 Day', description: 'Quick drop' },
  { value: 3, label: '3 Days', description: 'Standard', recommended: true },
  { value: 7, label: '7 Days', description: 'Max reach' },
];

const DEVICE_TYPE = () => {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
};

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

async function generateVideoThumbnail(file) {
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
  video.crossOrigin = 'anonymous';

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Could not load video for editing.'));
    });

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

const TEXT_GRADIENTS = [
  { style: { background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)' }, name: 'Sunset' },
  { style: { background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' }, name: 'Ocean' },
  { style: { background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' }, name: 'Purple Dream' },
  { style: { background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }, name: 'Neon Green' },
  { style: { background: 'linear-gradient(135deg, #0f0c1b 0%, #201335 100%)' }, name: 'Midnight' },
  { style: { background: 'linear-gradient(135deg, #e65c00 0%, #F9D423 100%)' }, name: 'Warm Sun' },
];

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
  const [editingVideo, setEditingVideo] = useState(false);
  const [gradientIndex, setGradientIndex] = useState(0);

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
        setEditingVideo(true);
        setError(needsTrim
          ? `Video is longer than ${STATUS_VIDEO_MAX_SECONDS}s — trim your clip before posting.`
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

      // If resharing image/video and no new file was selected, reuse existing URL
      if (type !== 'text' && file) {
        let uploadFile = file;
        if (file.type.startsWith('video/')) {
          const clipLength = trimEnd - trimStart;
          if (clipLength > STATUS_VIDEO_MAX_SECONDS + 0.5) {
            throw new Error(`Story clips must be ${STATUS_VIDEO_MAX_SECONDS} seconds or less.`);
          }

          setUploadPhase('Preparing video...');
          uploadFile = await exportEditedStatusVideo(file, {
            trimStart,
            trimEnd,
            onProgress: (pct) => setUploadProgress(Math.min(70, pct)),
          });
          if (uploadFile.size > STATUS_VIDEO_MAX_BYTES) {
            throw new Error('Edited video is still above 30MB. Shorten the trim and try again.');
          }
        }

        setUploadPhase(uploadFile.type.startsWith('video/') ? 'Uploading video...' : 'Uploading image...');
        const uploadRes = await uploadService.uploadSingle(uploadFile, 'statuses', {
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
        finalUrl = uploadRes.data.url;
        if (uploadFile.type.startsWith('video/')) {
          setUploadPhase('Creating video preview...');
          const thumbnailFile = await generateVideoThumbnail(uploadFile);
          if (thumbnailFile) {
            const thumbnailRes = await uploadService.uploadSingle(thumbnailFile, 'statuses');
            if (thumbnailRes.success) thumbnailUrl = thumbnailRes.data.url;
          }
        }
        setUploadPhase('Publishing story...');
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

  if (!mounted) return null;

  // Render Type Selector
  const typeSelector = (
    <div className="relative flex bg-[var(--bg-secondary)] p-1 rounded-2xl border border-[var(--glass-border)] w-full">
      {/* Background sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-xl bg-[var(--bg-primary)] shadow-md transition-all duration-300 ease-out"
        style={{
          left: type === 'image' ? '4px' : type === 'video' ? 'calc(33.333% + 2px)' : 'calc(66.666% + 2px)',
          width: 'calc(33.333% - 6px)',
        }}
      />
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
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 ${
              type === t.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="size-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  // Render Preview Frame
  const previewFrame = (
    <div className="relative aspect-[9/16] w-full max-w-[280px] mx-auto rounded-[2.5rem] overflow-hidden bg-black border border-white/10 group shadow-2xl flex flex-col justify-between">
      {previewUrl ? (
        <>
          {type === 'video' ? (
            <video src={previewUrl} className="absolute inset-0 size-full object-cover" autoPlay muted loop />
          ) : (
            <img src={previewUrl} className="absolute inset-0 size-full object-cover" alt="story preview" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          
          {/* Top action button */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            {!isReshare || file ? (
              <button
                type="button"
                onClick={() => { setFile(null); setPreviewUrl(''); }}
                className="size-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-all border border-white/10 shadow-lg"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <label className="size-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-[var(--accent)] transition-all border border-white/10 shadow-lg cursor-pointer">
                <input type="file" className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} />
                <ImageIcon className="size-4" />
              </label>
            )}
          </div>

          {/* Floaty Caption overlay (WhatsApp style) */}
          <div className="absolute bottom-4 inset-x-4 z-20">
            <div className="relative flex items-center bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-2">
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 150))}
                placeholder="Add context to your story..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/40 outline-none border-none pr-8 py-1"
              />
              <span className="absolute right-3 text-[10px] text-white/30 font-mono font-bold">
                {caption.length}/150
              </span>
            </div>
          </div>
        </>
      ) : type === 'text' ? (
        <div 
          className="absolute inset-0 flex flex-col p-6 transition-all duration-300 select-none justify-between"
          style={TEXT_GRADIENTS[gradientIndex].style}
        >
          {/* Gradient index controller */}
          <button
            type="button"
            onClick={() => setGradientIndex((prev) => (prev + 1) % TEXT_GRADIENTS.length)}
            className="absolute top-4 right-4 size-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20"
            title="Change background gradient"
          >
            <Palette className="size-4" />
          </button>

          <div className="flex-1 flex items-center justify-center">
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-transparent text-xl md:text-2xl font-bold text-white text-center outline-none placeholder:text-white/20 resize-none max-h-[70%] leading-relaxed"
              maxLength={300}
            />
          </div>
          <span className="text-[10px] text-white/40 font-bold tracking-wider text-center">{textContent.length} / 300</span>
        </div>
      ) : (
        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-4 text-center px-6 bg-[var(--bg-secondary)] border border-dashed border-[var(--glass-border)] hover:border-[var(--accent)] transition-all">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
          <div className="size-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:scale-105 transition-transform shadow-md">
            {type === 'image' ? <ImageIcon className="size-6 text-[var(--accent)]" /> : <Video className="size-6 text-[var(--accent)]" />}
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">Upload {type === 'image' ? 'Image' : 'Video'}</p>
            <p className="text-[10px] text-[var(--text-secondary)] opacity-50 mt-1 leading-snug">Max {type === 'image' ? '8MB' : '500MB source · auto-trimmed to 30s'}</p>
          </div>
        </label>
      )}
    </div>
  );

  // Render Metadata Options
  const metadataOptions = (
    <div className="space-y-5">
      {/* Expiry / Duration */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          <Clock className="size-3 text-[var(--accent)]" /> Story Duration
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {DURATION_OPTIONS.map(opt => {
            const active = expiryDays === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExpiryDays(opt.value)}
                className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between min-h-[72px] transition-all duration-300 ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-lg shadow-[var(--accent)]/5'
                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30'
                }`}
              >
                {opt.recommended && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow z-10">
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

      {/* Category Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Category</label>
          {!selectedCategory && <span className="text-[10px] font-bold text-red-400">Required</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto no-scrollbar border border-[var(--glass-border)] rounded-2xl bg-[var(--bg-secondary)]/50 p-2">
          {STATUS_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`py-2 px-2 rounded-xl text-[11px] font-bold border text-center transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Caption Section */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Caption</label>
        <div className="relative">
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add context to your story..."
            className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-3 text-xs font-semibold focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-30 resize-none text-[var(--text-primary)]"
            maxLength={150}
          />
          <span className="absolute bottom-2.5 right-3 text-[10px] font-bold opacity-30">{caption.length}/150</span>
        </div>
      </div>

      {/* Tag Product */}
      <div className="space-y-2">
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
                placeholder="Search your products..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-9 pr-4 text-xs font-semibold focus:border-[var(--accent)] outline-none transition-all text-[var(--text-primary)]"
              />
              {searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-1.5 max-h-40 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl z-50 p-1 space-y-0.5">
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

  // Render Post Button & Upload Progress
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
        className="w-full h-12 bg-[var(--accent)] text-white rounded-2xl text-xs font-extrabold uppercase tracking-wider hover:brightness-115 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
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

  // Render Mobile Layout View
  const mobileLayout = (
    <div className="fixed inset-0 z-[1100] bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="shrink-0 h-16 border-b border-[var(--glass-border)] flex items-center justify-between px-4">
        <h1 className="text-base font-black text-[var(--text-primary)]">
          {isReshare ? 'Reshare Story' : 'New Story'}
        </h1>
        <button 
          onClick={onClose} 
          className="size-10 rounded-full hover:bg-[var(--bg-secondary)] flex items-center justify-center transition-all text-[var(--text-secondary)]"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Main Form Content Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 no-scrollbar">
        {/* Sliding type tab */}
        {typeSelector}

        {/* 9:16 aspect preview */}
        {previewFrame}

        {/* Video Trimmer panel (if type is video, preview exists and metadata loaded) */}
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

        {/* Story details / settings */}
        <div className="border-t border-[var(--glass-border)] pt-5">
          {metadataOptions}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="absolute bottom-0 inset-x-0 bg-[var(--bg-primary)]/90 backdrop-blur-md border-t border-[var(--glass-border)] p-4">
        {submitButton}
      </div>
    </div>
  );

  // Render Desktop Layout View
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
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-5xl bg-[var(--bg-primary)] rounded-[2.5rem] border border-white/8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top visual divider bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50 shrink-0" />

        {/* Header */}
        <div className="shrink-0 px-8 py-5 flex items-center justify-between border-b border-[var(--glass-border)]">
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              {isReshare ? 'Reshare Story' : 'New Story'}
            </h2>
            {isReshare && (
              <p className="text-[10px] font-bold text-[var(--accent)] mt-0.5 flex items-center gap-1 opacity-80">
                <RotateCcw className="size-3" /> Reusing previous content — replace below if desired
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all border border-[var(--glass-border)]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal columns */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.8fr] gap-0 min-h-full">
            {/* Left preview column */}
            <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-[var(--glass-border)] flex flex-col gap-5 bg-[var(--bg-secondary)]/15">
              {typeSelector}
              
              {previewFrame}

              {type === 'video' && videoMeta && previewUrl && (
                <div className="mt-2">
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

              {error && (
                <div className="p-3 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center gap-2.5 text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-xs font-semibold">{error}</p>
                </div>
              )}
            </div>

            {/* Right configuration options column */}
            <div className="p-6 md:p-8 flex flex-col justify-between gap-6 overflow-y-auto max-h-[72vh] no-scrollbar">
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
