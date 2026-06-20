"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Clock, Search,
  Plus, Palette, SplitSquareHorizontal, Scissors,
  Crop, Sticker, Pencil, AtSign,
  Volume2, VolumeX
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
import { prepareStatusVideoForUpload } from '@/lib/statusVideoExport';

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

export default function StatusCreator({ onClose, onStatusCreated, initialData = null }) {
  const isReshare = !!initialData;

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
  const [videoPostMode, setVideoPostMode] = useState('split');
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

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const previewVideoRef = useRef(null);
  const trimmerTrackRef = useRef(null);

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

  const handleFileChange = async (e, nextType = type) => {
    const f = e.target.files[0];
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
        setVideoPostMode(needsTrim ? 'split' : 'trim');
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
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (nextType !== 'video') setError(null);
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

  const startDrag = (event, handle) => {
    event.stopPropagation();
    const track = trimmerTrackRef.current;
    if (!track || !videoMeta?.duration) return;

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
        setTrimStart(Math.max(0, Math.min(newTime, trimEnd - 0.5)));
      } else {
        const maxEnd = Math.min(duration, trimStart + STATUS_VIDEO_MAX_SECONDS);
        setTrimEnd(Math.max(trimStart + 0.5, Math.min(newTime, maxEnd)));
      }
    };

    const endDrag = () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', endDrag);
    };

    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onDrag);
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

  const layout = (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden font-[Poppins]">
      {/* Blurred background showing status contents (premium gradient/image blur) */}
      {previewUrl && (
        <div 
          className="absolute inset-0 z-0 opacity-20 blur-3xl scale-125 transition-all duration-500 pointer-events-none"
          style={type === 'text' ? TEXT_GRADIENTS[gradientIndex].style : { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* Central Phone Mockup Container */}
      <div className="relative z-10 w-full h-full md:h-[90vh] md:max-h-[760px] md:aspect-[9/16] md:rounded-[2.5rem] md:border-8 md:border-[#202022] md:shadow-2xl bg-black overflow-hidden flex flex-col">
        
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
                  onClick={() => { setFile(null); setPreviewUrl(''); setVideoMeta(null); }}
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
                  onClick={() => { setType('image'); setPreviewUrl(''); setFile(null); }}
                  className={`p-2 rounded-full transition-colors ${type === 'image' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Photo Mode"
                >
                  <ImageIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setType('video'); setPreviewUrl(''); setFile(null); }}
                  className={`p-2 rounded-full transition-colors ${type === 'video' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Video Mode"
                >
                  <Video className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setType('text'); setPreviewUrl(''); setFile(null); }}
                  className={`p-2 rounded-full transition-colors ${type === 'text' ? 'text-[#20c763] bg-white/5' : 'text-white hover:bg-white/10'}`}
                  title="Text Mode"
                >
                  <Type className="size-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* WhatsApp-Style Top Inline Scrubber (Video Trimmer) */}
        {type === 'video' && videoMeta && previewUrl && showTrimmer && (
          <div className="px-4 py-3 border-b border-white/5 bg-black/60 backdrop-blur-sm z-30 shrink-0 select-none font-[Poppins]">
            <div className="flex items-center justify-between mb-2 text-[10px] font-bold text-white/50 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Scissors className="size-3 text-[#20c763]" />
                <span>Trim: {formatSeconds(trimStart)} - {formatSeconds(trimEnd)}</span>
              </span>
              <span>{selectedLength.toFixed(1)}s / {maxClip}s</span>
            </div>
            
            {/* Scrubber track */}
            <div 
              ref={trimmerTrackRef}
              onClick={handleTrackClick}
              className="relative h-6 flex items-center cursor-pointer"
            >
              {/* Timeline background track */}
              <div className="absolute inset-x-0 h-1.5 bg-white/10 rounded-full" />
              
              {/* Highlight selection range */}
              <div 
                className="absolute h-1.5 bg-[#20c763] rounded-full"
                style={{
                  left: `${(trimStart / (videoMeta?.duration || 1)) * 100}%`,
                  right: `${100 - (trimEnd / (videoMeta?.duration || 1)) * 100}%`
                }}
              />
              
              {/* Playhead line */}
              <div 
                className="absolute h-full w-0.5 bg-white z-10 pointer-events-none"
                style={{ left: `${(currentTime / (videoMeta?.duration || 1)) * 100}%` }}
              />
              
              {/* Start Handle */}
              <div 
                className="absolute size-4 rounded-full bg-[#20c763] border-2 border-white cursor-ew-resize z-20 shadow hover:scale-110 active:scale-95 transition-transform"
                style={{ left: `${(trimStart / (videoMeta?.duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => startDrag(e, 'start')}
                onTouchStart={(e) => startDrag(e, 'start')}
              />
              
              {/* End Handle */}
              <div 
                className="absolute size-4 rounded-full bg-[#20c763] border-2 border-white cursor-ew-resize z-20 shadow hover:scale-110 active:scale-95 transition-transform"
                style={{ left: `${(trimEnd / (videoMeta?.duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => startDrag(e, 'end')}
                onTouchStart={(e) => startDrag(e, 'end')}
              />
            </div>
          </div>
        )}

        {/* Central Workspace / Media Preview Container */}
        <div className="flex-1 relative bg-[#09090b] flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
              {type === 'video' ? (
                <video
                  ref={previewVideoRef}
                  src={previewUrl}
                  className={`w-full h-full ${previewFitClass} z-10`}
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                />
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
                <div className="absolute top-4 left-4 right-4 z-20 p-2.5 rounded-2xl border border-[#20c763]/25 bg-black/75 backdrop-blur-md flex items-center justify-between min-w-0 shadow-xl">
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
                    setPreviewUrl('');
                    setFile(null);
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
                    <span>{uploadProgress}%</span>
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
                <Clock className="size-3.5 text-[#20c763]" />
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
                <Sticker className="size-3.5" />
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
                  <Sticker className="size-5" />
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
                  <Clock className="size-5" />
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
