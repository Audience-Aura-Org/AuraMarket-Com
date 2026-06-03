"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  AlertCircle, Clock, Search, Tag, RotateCcw,
  Plus
} from 'lucide-react';
import { uploadService } from '@/services/upload';
import api from '@/services/api';
import { STATUS_CATEGORIES } from '@/constants/statusCategories';

const DURATION_OPTIONS = [
  { value: 1, label: '1 Day',  sublabel: 'Quick drop'  },
  { value: 3, label: '3 Days', sublabel: 'Standard', recommended: true },
  { value: 7, label: '7 Days', sublabel: 'Max reach' },
];

/**
 * StatusCreator — single-screen story composer.
 * Accepts optional `initialData` for resharing an existing story.
 */
export default function StatusCreator({ onClose, onStatusCreated, initialData = null }) {
  const isReshare = !!initialData;

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

  const fileInputRef = useRef(null);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

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

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (type === 'video') {
      if (!f.type.startsWith('video/'))  { setError('Select a video file.'); return; }
      if (f.size > 500 * 1024 * 1024)   { setError('Max 500MB video.'); return; }
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        window.URL.revokeObjectURL(vid.src);
        if (vid.duration > 61) { setError('Video must be under 1 minute.'); setFile(null); setPreviewUrl(''); }
      };
      vid.src = URL.createObjectURL(f);
    } else {
      if (!f.type.startsWith('image/'))  { setError('Select an image file.'); return; }
      if (f.size > 10 * 1024 * 1024)    { setError('Max 10MB image.'); return; }
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  };

  const handlePost = async () => {
    if (!selectedCategory) { setError('Please select a category.'); return; }
    setLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    setError(null);
    try {
      let finalUrl = previewUrl;

      // If resharing image/video and no new file was selected, reuse existing URL
      if (type !== 'text' && file) {
        setUploadPhase(file.type.startsWith('video/') ? 'Uploading video…' : 'Uploading image…');
        const uploadRes = await uploadService.uploadSingle(file, 'statuses', {
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (!uploadRes.success) throw new Error(uploadRes.message || 'Media upload failed');
        finalUrl = uploadRes.data.url;
        setUploadPhase('Publishing story…');
      } else if (type !== 'text' && !isReshare && !previewUrl) {
        throw new Error('Please select a file to upload');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const payload = {
        type,
        content_url: type !== 'text' ? finalUrl : '',
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

  const modal = (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create Story"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="relative w-full max-w-5xl bg-[var(--bg-primary)] rounded-[2.5rem] border border-white/8 shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Accent top bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60 shrink-0" />

        {/* Header */}
        <div className="px-8 pt-6 pb-5 flex items-center justify-between border-b border-[var(--glass-border)] shrink-0">
          <div>
            <h2 className="text-xl  font-bold tracking-tight text-[var(--text-primary)] leading-none">
              {isReshare ? 'Reshare Story' : 'New Story'}
            </h2>
            {isReshare && (
              <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] mt-1 flex items-center gap-1.5 opacity-80">
                <RotateCcw className="size-3" /> Reusing previous content — change anything below
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body — two column on desktop */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-0 min-h-full">

            {/* Left — media preview */}
            <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-[var(--glass-border)] flex flex-col gap-5">
              {/* Type selector */}
              <div className="flex bg-[var(--bg-secondary)] p-1 rounded-2xl border border-[var(--glass-border)]">
                {[
                  { id: 'image', label: 'Image' },
                  { id: 'video', label: 'Video' },
                  { id: 'text',  label: 'Text'  },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setType(t.id); if (!isReshare) { setFile(null); setPreviewUrl(''); } setError(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all ${type === t.id ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Preview area — phone-like 9:16 crop */}
              <div className="relative aspect-[9/16] rounded-[2rem] overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] group flex-1 max-h-[420px]">
                {previewUrl ? (
                  <>
                    {type === 'video'
                      ? <video src={previewUrl} className="absolute inset-0 size-full object-cover" autoPlay muted loop />
                      : <img src={previewUrl} className="absolute inset-0 size-full object-cover" alt="" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {!isReshare || file ? (
                      <button
                        onClick={() => { setFile(null); setPreviewUrl(''); }}
                        className="absolute top-4 right-4 size-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-xl z-20 border border-white/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : (
                      /* Reshare: allow replacing */
                      <label className="absolute top-4 right-4 size-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-[var(--accent)] transition-all shadow-xl z-20 border border-white/10 cursor-pointer">
                        <input type="file" className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} />
                        <ImageIcon className="size-4" />
                      </label>
                    )}
                  </>
                ) : type === 'text' ? (
                  <div className="absolute inset-0 flex flex-col p-6 bg-gradient-to-br from-[#060606] to-[#180920]">
                    <textarea
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent text-2xl  font-bold text-white text-center outline-none placeholder:text-white/15 resize-none pt-12 leading-tight"
                      maxLength={300}
                    />
                    <span className="text-[11px] lg:text-[12px]  font-semibold text-white/20 tracking-tight text-center pb-2">{textContent.length} / 300</span>
                  </div>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-4 text-center px-6">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
                    <div className="size-16 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:border-[var(--accent)] transition-all">
                      {type === 'image' ? <ImageIcon className="size-7 text-[var(--accent)]" /> : <Video className="size-7 text-[var(--accent)]" />}
                    </div>
                    <div>
                      <p className="text-sm  font-bold text-[var(--text-primary)] tracking-tight">Upload {type === 'image' ? 'Image' : 'Video'}</p>
                      <p className="text-[11px] lg:text-[12px] text-[var(--text-secondary)] opacity-40 mt-1">Max {type === 'image' ? '10MB' : '500MB · under 1 min'}</p>
                    </div>
                  </label>
                )}
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center gap-3 text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-xs  font-semibold">{error}</p>
                </div>
              )}
            </div>

            {/* Right — details */}
            <div className="p-6 md:p-8 flex flex-col gap-7 overflow-y-auto no-scrollbar">

              {/* Duration */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold  tracking-[0.18em] text-[var(--text-secondary)]">
                  <Clock className="size-3.5 text-[var(--accent)]" /> Story Duration
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {DURATION_OPTIONS.map(opt => {
                    const active = expiryDays === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setExpiryDays(opt.value)}
                        className={`relative py-4 rounded-2xl border text-center transition-all duration-300 ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/8 shadow-md'
                            : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40'
                        }`}
                      >
                        {opt.recommended && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[11px] lg:text-[12px]  font-semibold bg-[var(--accent)] text-white px-2 py-0.5 rounded-full tracking-normal whitespace-nowrap">
                            Best
                          </span>
                        )}
                        <p className={`text-sm  font-bold ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{opt.label}</p>
                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50 mt-0.5">{opt.sublabel}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.18em] text-[var(--text-secondary)]">Category</label>
                  {!selectedCategory && <span className="text-[11px] lg:text-[12px]  font-semibold text-red-400 tracking-tight">Required</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all ${
                        selectedCategory === cat
                          ? 'bg-[var(--accent)] text-white shadow-md'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-3">
                <label className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.18em] text-[var(--text-secondary)]">Caption</label>
                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add context to your story..."
                    className="w-full h-24 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-4 text-sm font-medium focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-30 resize-none text-[var(--text-primary)]"
                    maxLength={150}
                  />
                  <span className="absolute bottom-3 right-4 text-[11px] lg:text-[12px]  font-semibold opacity-20">{caption.length}/150</span>
                </div>
              </div>

              {/* Link Product */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.18em] text-[var(--text-secondary)] flex items-center gap-2">
                    <ShoppingBag className="size-3.5 text-[var(--accent)]" /> Tag Product
                  </label>
                  <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] opacity-70 tracking-tight">Optional</span>
                </div>

                {linkedProduct ? (
                  <div className="p-3.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] shrink-0">
                        <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-[12px]  font-semibold text-[var(--text-primary)] line-clamp-1">{linkedProduct.name}</p>
                        <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] mt-0.5">{linkedProduct.price?.toLocaleString()} XAF</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkedProduct(null)} className="size-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">
                        <Search className="size-4" />
                      </div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search your products..."
                        className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-10 pr-4 !text-base placeholder:!text-base font-medium focus:border-[var(--accent)] outline-none transition-all"
                      />
                      {searchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-2 max-h-52 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5">
                          {filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <button
                              key={p._id}
                              onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-left"
                            >
                              <div className="size-10 rounded-lg overflow-hidden border border-[var(--glass-border)] shrink-0">
                                <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-full object-cover" alt="" />
                              </div>
                              <div>
                                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] mt-0.5">{p.price?.toLocaleString()} XAF</p>
                              </div>
                            </button>
                          )) : (
                            <div className="p-6 text-center text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-30">No products found</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] lg:text-[11px] font-medium text-[var(--text-secondary)] opacity-60">Can't find your product?</span>
                      <a 
                        href="/vendor/products/add" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] lg:text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 transition-all"
                      >
                        <Plus className="size-3" />
                        Add new product
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer push */}
              <div className="flex-1" />

              {loading && uploadPhase && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span>{uploadPhase}</span>
                    {uploadProgress > 0 && <span className="tabular-nums">{uploadProgress}%</span>}
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${Math.max(uploadProgress, uploadPhase ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handlePost}
                disabled={loading || !canPost}
                className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl text-[11px] lg:text-[12px]  font-semibold tracking-tight hover:brightness-110 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading
                  ? <Loader2 className="size-4 animate-spin" />
                  : <><Send className="size-4" /> {isReshare ? 'Reshare Story' : 'Publish Story'}</>
                }
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modal, document.body);
}
