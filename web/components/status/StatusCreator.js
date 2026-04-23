"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  CheckCircle2, AlertCircle, Clock, Flame, Zap, Shield,
  Eye, Sparkles, ChevronRight, Layout, Tag
} from 'lucide-react';
import { uploadService } from '@/services/upload';
import api from '@/services/api';

const DURATION_OPTIONS = [
  {
    value: 1,
    label: '1 Day',
    sublabel: 'Quick Drop',
    icon: Zap,
    color: 'from-amber-400 to-orange-500',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-500',
  },
  {
    value: 3,
    label: '3 Days',
    sublabel: 'Standard',
    icon: Flame,
    color: 'from-[var(--accent)] to-purple-500',
    border: 'border-[var(--accent)]/30',
    bg: 'bg-[var(--accent)]/5',
    text: 'text-[var(--accent)]',
    recommended: true,
  },
  {
    value: 7,
    label: '7 Days',
    sublabel: 'Max Reach',
    icon: Shield,
    color: 'from-emerald-400 to-teal-500',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-500',
  },
];

export default function StatusCreator({ onClose, onStatusCreated }) {
  const [type, setType] = useState('image');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [caption, setCaption] = useState('');
  const [linkedProduct, setLinkedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Media, 2: Details & Duration, 3: Final Preview
  const [expiryDays, setExpiryDays] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState(null); // No default, must select

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (step === 2) {
      api.get('/products/hub', { params: { limit: 50, self: true } })
        .then(res => { if (res.data.success) setProducts(res.data.data.products || []); })
        .catch(e => console.error(e));
    }
  }, [step]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (type === 'video') {
      if (!selectedFile.type.startsWith('video/')) { setError('Please select a video file.'); return; }
      if (selectedFile.size > 100 * 1024 * 1024) { setError('File too large. Max 100MB.'); return; }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 61) { setError('Video exceeds 1 minute limit.'); setFile(null); setPreviewUrl(''); }
      };
      video.src = URL.createObjectURL(selectedFile);
    } else if (type === 'image') {
      if (!selectedFile.type.startsWith('image/')) { setError('Please select an image file.'); return; }
      if (selectedFile.size > 10 * 1024 * 1024) { setError('Image too large. Max 10MB.'); return; }
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const handlePost = async () => {
    setLoading(true);
    setError(null);
    try {
      let finalUrl = '';
      if (type !== 'text') {
        if (!file) throw new Error('Please select a file to upload');
        const uploadRes = await uploadService.uploadSingle(file, 'statuses');
        if (!uploadRes.success) throw new Error('Media upload failed');
        finalUrl = uploadRes.data.url;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const statusData = {
        type,
        content_url: finalUrl,
        text_content: type === 'text' ? textContent : '',
        caption,
        linked_product: linkedProduct?._id || null,
        expires_at: expiresAt.toISOString(),
        expiry_days: expiryDays,
        category: selectedCategory || 'General',
      };

      const res = await api.post('/statuses', statusData);
      if (res.data.success) {
        onStatusCreated(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to post status');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canProceed = (type === 'text' ? textContent.trim() : file) && (step < 3 || selectedCategory);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        layout
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className={`relative w-full ${step === 3 ? 'max-w-sm' : 'max-w-xl'} bg-[var(--bg-primary)] rounded-[3rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-all duration-500`}
      >
        {/* Progress Header */}
        <div className="absolute top-0 inset-x-0 h-1 z-50">
           <motion.div 
             className="h-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
             initial={{ width: '33%' }}
             animate={{ width: `${(step / 3) * 100}%` }}
           />
        </div>

        {/* Content Container */}
        <div className={`flex-1 flex flex-col ${step === 3 ? 'h-[75vh]' : 'max-h-[85vh]'}`}>
          
          {/* Header */}
          <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-4">
                <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg ${step === 1 ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                   {step === 1 ? <Layout className="size-6" /> : <CheckCircle2 className="size-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tighter uppercase italic text-[var(--text-primary)]">
                    {step === 1 ? 'New Story' : step === 2 ? 'Story Details' : 'Final Preview'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                     {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1 rounded-full transition-all duration-300 ${s === step ? 'w-4 bg-[var(--accent)]' : s < step ? 'w-2 bg-emerald-500' : 'w-2 bg-[var(--glass-border)]'}`} />
                     ))}
                     <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1 opacity-40">Step {step}/3</span>
                  </div>
                </div>
             </div>
             <button onClick={onClose} className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all">
                <X className="size-5" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-8">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
                  {/* Type Selector */}
                  <div className="flex bg-[var(--bg-secondary)] p-1.5 rounded-[2rem] border border-[var(--glass-border)]">
                    {[
                      { id: 'image', icon: ImageIcon, label: 'Image' },
                      { id: 'video', icon: Video, label: 'Video' },
                      { id: 'text', icon: Type, label: 'Text' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setType(t.id); setFile(null); setPreviewUrl(''); setError(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${type === t.id ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-xl' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                      >
                        <t.icon className="size-4" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Media dropzone */}
                  <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border-2 border-dashed border-[var(--glass-border)] hover:border-[var(--accent)] transition-all bg-[var(--bg-secondary)] group">
                    {previewUrl ? (
                      <div className="absolute inset-0">
                         {type === 'video' ? (
                           <video src={previewUrl} className="size-full object-cover" autoPlay muted loop />
                         ) : (
                           <img src={previewUrl} className="size-full object-cover" alt="" />
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                         <button onClick={() => { setFile(null); setPreviewUrl(''); }} className="absolute top-6 right-6 size-12 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-2xl z-20 border border-white/10">
                            <Trash2 className="size-5" />
                         </button>
                      </div>
                    ) : type === 'text' ? (
                      <div className="size-full flex flex-col p-8 bg-gradient-to-br from-[#050505] to-[#1a0a2e]">
                         <textarea
                           value={textContent}
                           onChange={e => setTextContent(e.target.value)}
                           placeholder="Type your vibe..."
                           className="flex-1 bg-transparent text-3xl font-black italic text-white text-center flex items-center justify-center outline-none placeholder:text-white/10 resize-none pt-20"
                           maxLength={300}
                         />
                         <div className="text-center pb-4">
                           <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{textContent.length} / 300</span>
                         </div>
                      </div>
                    ) : (
                      <label className="size-full flex flex-col items-center justify-center cursor-pointer p-8 text-center group">
                         <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
                         <div className="size-20 rounded-[2.5rem] bg-[var(--bg-primary)] flex items-center justify-center shadow-2xl border border-[var(--glass-border)] group-hover:scale-110 transition-all duration-500 group-hover:border-[var(--accent)]">
                            {type === 'image' ? <ImageIcon className="size-8 text-[var(--accent)]" /> : <Video className="size-8 text-[var(--accent)]" />}
                         </div>
                         <h4 className="text-lg font-black text-[var(--text-primary)] mt-6 tracking-tight">Upload {type === 'image' ? 'Visual' : 'Motion'}</h4>
                         <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40 mt-2 max-w-[180px]">Drag and drop or tap to select from your library. Max 100MB.</p>
                      </label>
                    )}
                  </div>

                  {error && (
                    <div className="p-4 rounded-3xl bg-red-500/5 border border-red-500/20 flex items-center gap-3 text-red-500">
                      <AlertCircle className="size-5 shrink-0" />
                      <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  <button
                    disabled={!canProceed}
                    onClick={() => setStep(2)}
                    className="w-full h-16 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-2xl disabled:opacity-20 active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    Set Details <ChevronRight className="size-5" />
                  </button>
                </motion.div>
              ) : step === 2 ? (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  
                  {/* Duration Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Clock className="size-4 text-[var(--accent)]" />
                      <label className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Story Life</label>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {DURATION_OPTIONS.map(opt => {
                        const isSelected = expiryDays === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setExpiryDays(opt.value)}
                            className={`relative flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-500 ${isSelected ? `${opt.border} ${opt.bg} shadow-xl scale-[1.05]` : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] opacity-40 hover:opacity-80'}`}
                          >
                            <opt.icon className={`size-6 ${isSelected ? opt.text : 'text-[var(--text-secondary)]'}`} />
                            <div className="text-center">
                              <p className={`text-xs font-black ${isSelected ? opt.text : 'text-[var(--text-primary)]'}`}>{opt.label}</p>
                              <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase mt-0.5">{opt.sublabel}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Story Category</label>
                      <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest bg-[var(--accent)]/10 px-2 py-1 rounded-full">Required Field</span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {['Fashion', 'Electronics', 'Lifestyle', 'Tech', 'Art', 'Beauty', 'General'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 transform ${selectedCategory === cat ? 'bg-[var(--accent)] text-white shadow-lg scale-105 border-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-40 border border-[var(--glass-border)] hover:opacity-100 hover:scale-102'}`}
                        >
                          {selectedCategory === cat && <Sparkles className="size-3 inline-block mr-1.5 -mt-0.5" />}
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1">Story Caption</label>
                    <div className="relative group">
                      <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Add some context..."
                        className="w-full h-32 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-[2rem] p-6 text-sm font-medium focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-30 resize-none"
                        maxLength={150}
                      />
                      <span className="absolute bottom-4 right-6 text-[10px] font-black opacity-20">{caption.length}/150</span>
                    </div>
                  </div>

                  {/* Tag Product */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShoppingBag className="size-4 text-[var(--accent)]" /> Link Product
                      </label>
                      <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest bg-[var(--accent)]/10 px-2 py-1 rounded-full">Convert Views</span>
                    </div>
                    {linkedProduct ? (
                      <div className="p-4 rounded-[2rem] border-2 border-[var(--accent)] bg-[var(--accent)]/5 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className="size-16 rounded-2xl overflow-hidden border border-[var(--glass-border)] shadow-sm bg-white/5">
                            <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
                          </div>
                          <div>
                            <p className="text-[13px] font-black text-[var(--text-primary)] tracking-tight line-clamp-1">{linkedProduct.name}</p>
                            <p className="text-[11px] font-bold text-[var(--accent)] mt-0.5">{linkedProduct.price?.toLocaleString()} XAF</p>
                          </div>
                        </div>
                        <button onClick={() => setLinkedProduct(null)} className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all">
                          <Trash2 className="size-4.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Search items to tag..."
                          className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-6 pr-12 text-sm font-medium focus:border-[var(--accent)] outline-none transition-all"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20"><Sparkles className="size-5" /></div>
                        {searchTerm && (
                          <div className="absolute top-full left-0 right-0 mt-3 max-h-64 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
                            {filteredProducts.length > 0 ? filteredProducts.map(p => (
                              <button
                                key={p._id}
                                onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                                className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-[var(--bg-secondary)] transition-all text-left"
                              >
                                <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] shrink-0">
                                  <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-full object-cover" alt="" />
                                </div>
                                <div>
                                  <p className="text-[12px] font-black text-[var(--text-primary)] truncate">{p.name}</p>
                                  <p className="text-[10px] font-bold text-[var(--accent)] mt-0.5">{p.price?.toLocaleString()} XAF</p>
                                </div>
                              </button>
                            )) : (
                              <div className="p-8 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">No products found</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(1)} className="px-8 h-16 rounded-[2rem] border border-[var(--glass-border)] text-xs font-black uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all">Back</button>
                    <button onClick={() => setStep(3)} className="flex-1 h-16 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-2xl flex items-center justify-center gap-3">
                       Preview <Eye className="size-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center">
                  
                  {/* Mock Story Viewer */}
                  <div className="relative w-full aspect-[9/16] rounded-[2.5rem] overflow-hidden bg-black border border-white/20 shadow-2xl scale-[0.95]">
                     {previewUrl ? (
                        <div className="size-full">
                           {type === 'video' ? <video src={previewUrl} className="size-full object-cover" autoPlay muted loop /> : <img src={previewUrl} className="size-full object-cover" alt="" />}
                        </div>
                     ) : (
                        <div className="size-full flex items-center justify-center p-8 text-center bg-gradient-to-br from-[#050505] to-[#1a0a2e]">
                           <p className="text-2xl font-black italic text-white leading-tight">{textContent}</p>
                        </div>
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                     
                     {/* Story Meta Overlay */}
                     <div className="absolute top-6 inset-x-4 flex gap-1 px-2">
                        <div className="h-1 flex-1 bg-white rounded-full shadow-[0_0_8px_white]" />
                        <div className="h-1 flex-1 bg-white/20 rounded-full" />
                     </div>
                     <div className="absolute top-12 left-6 flex items-center gap-2">
                        <div className="size-8 rounded-full bg-white/20 border border-white/40" />
                        <div className="w-20 h-2 bg-white/20 rounded-full" />
                     </div>

                     <div className="absolute bottom-10 inset-x-6">
                        <div className="flex items-center gap-2 mb-3">
                           <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-[8px] font-black uppercase text-white flex items-center gap-1">
                              <Tag className="size-2.5" /> {selectedCategory || 'Pick Category'}
                           </div>
                        </div>
                        {caption && <p className="text-sm text-white/90 font-medium mb-4 line-clamp-2">{caption}</p>}
                        {linkedProduct && (
                           <div className="w-full p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="size-10 rounded-xl bg-white/5" />
                                 <div className="w-20 h-2 bg-white/20 rounded-full" />
                              </div>
                              <div className="size-8 rounded-full bg-[var(--accent)]" />
                           </div>
                        )}
                     </div>
                  </div>

                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] mt-6 opacity-40 italic">Vibe Check Passed</p>

                  <div className="w-full grid grid-cols-2 gap-4 mt-8">
                     <button onClick={() => setStep(2)} className="h-16 rounded-[2rem] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all">Refine</button>
                      <button 
                        onClick={handlePost} 
                        disabled={loading || !selectedCategory}
                        className={`h-16 bg-[var(--accent)] text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed`}
                      >
                        {loading ? <Loader2 className="size-5 animate-spin" /> : <><Sparkles className="size-5" /> Post Story</>}
                      </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
