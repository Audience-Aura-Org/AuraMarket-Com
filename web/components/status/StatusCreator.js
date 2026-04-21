"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Image as ImageIcon, Video, Type, 
  ShoppingBag, Trash2, Send, Loader2,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { uploadService } from '@/services/upload';
import api from '@/services/api';

/**
 * StatusCreator
 * Modal for vendors to create and post new statuses.
 * Supports Image, Video, and Text statuses with product linkage.
 */
export default function StatusCreator({ onClose, onStatusCreated }) {
  const [type, setType] = useState('image'); // image, video, text
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [caption, setCaption] = useState('');
  const [linkedProduct, setLinkedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Select Type/Media, 2: Details & Product

  // Fetch vendor's products for tagging
  useEffect(() => {
    if (step === 2) {
      const fetchProducts = async () => {
        try {
          const res = await api.get('/products/hub', { params: { limit: 50, self: true } });
          if (res.data.success) setProducts(res.data.data.products || []);
        } catch (e) { console.error(e); }
      };
      fetchProducts();
    }
  }, [step]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Type validation
    if (type === 'video' && !selectedFile.type.startsWith('video/')) {
       setError('Please select a video file.');
       return;
    }
    if (type === 'image' && !selectedFile.type.startsWith('image/')) {
       setError('Please select an image file.');
       return;
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
      
      // 1. Upload media if not text
      if (type !== 'text') {
        if (!file) throw new Error('Please select a file to upload');
        const uploadRes = await uploadService.uploadSingle(file, 'statuses');
        if (!uploadRes.success) throw new Error('Media upload failed');
        finalUrl = uploadRes.data.url;
      }

      // 2. Create Status in DB
      const statusData = {
        type,
        content_url: finalUrl,
        text_content: type === 'text' ? textContent : '',
        caption,
        linked_product: linkedProduct?._id || null
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

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[var(--bg-primary)] rounded-[2.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Send className="size-5 text-[var(--accent)]" />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase italic tracking-tighter text-[var(--text-primary)]">Post New Status</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Aura Node Intelligence</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-all text-[var(--text-secondary)]">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-8">
          {step === 1 ? (
            <div className="space-y-8">
              {/* Type Selection */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'image', icon: ImageIcon, label: 'Image' },
                  { id: 'video', icon: Video, label: 'Video' },
                  { id: 'text', icon: Type, label: 'Text' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setType(t.id); setFile(null); setPreviewUrl(''); }}
                    className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all group ${type === t.id ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-lg' : 'border-[var(--glass-border)] hover:border-[var(--accent)]/30 bg-[var(--bg-secondary)] opacity-40 hover:opacity-100'}`}
                  >
                    <t.icon className={`size-6 ${type === t.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Media Upload Area */}
              <div className="relative group">
                {type === 'text' ? (
                  <textarea
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder="Type your status content here..."
                    className="w-full h-48 bg-[var(--bg-secondary)] rounded-3xl p-6 text-lg font-black italic uppercase text-center border-2 border-[var(--glass-border)] focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-20"
                    maxLength={500}
                  />
                ) : (
                  <div className="relative h-64 rounded-[2rem] overflow-hidden border-2 border-dashed border-[var(--glass-border)] group-hover:border-[var(--accent)] transition-all bg-[var(--bg-secondary)] flex flex-col items-center justify-center p-4">
                    {previewUrl ? (
                      <div className="absolute inset-0 z-0">
                        {type === 'video' ? (
                          <video src={previewUrl} className="size-full object-cover" controls />
                        ) : (
                          <img src={previewUrl} className="size-full object-cover" alt="" />
                        )}
                        <button 
                          onClick={() => { setFile(null); setPreviewUrl(''); }}
                          className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 transition-all shadow-xl z-20"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-4 cursor-pointer w-full h-full justify-center">
                        <input type="file" onChange={handleFileChange} className="hidden" accept={type === 'image' ? 'image/*' : 'video/*'} />
                        <div className="size-16 rounded-[2rem] bg-[var(--bg-primary)] flex items-center justify-center shadow-lg border border-[var(--glass-border)] group-hover:scale-110 transition-transform">
                          {type === 'image' ? <ImageIcon className="size-6 text-[var(--accent)]" /> : <Video className="size-6 text-[var(--accent)]" />}
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest">Select {type}</p>
                          <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-1">Max 5MB • {type === 'video' ? '30s max' : 'High res'}</p>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500">
                  <AlertCircle className="size-4 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-tight">{error}</p>
                </div>
              )}

              <button
                disabled={(!file && type !== 'text') || (type === 'text' && !textContent)}
                onClick={() => setStep(2)}
                className="w-full h-14 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl disabled:opacity-30 active:scale-95 flex items-center justify-center gap-2"
              >
                Continue Setup <Send className="size-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Caption */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">Add Caption</label>
                <input 
                  type="text"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Tell your story..."
                  className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-sm font-medium focus:border-[var(--accent)] outline-none"
                />
              </div>

              {/* Tag Product */}
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2 flex items-center justify-between">
                  Link a Product <span className="text-[8px] opacity-40 italic">Optional but recommended</span>
                </label>
                
                {linkedProduct ? (
                  <div className="p-4 rounded-3xl border-2 border-[var(--accent)] bg-[var(--accent)]/5 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)]">
                        <img src={typeof linkedProduct.images?.[0] === 'string' ? linkedProduct.images[0] : linkedProduct.images?.[0]?.url} className="size-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tighter line-clamp-1">{linkedProduct.name}</p>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)]">{linkedProduct.price?.toLocaleString()} XAF</p>
                      </div>
                    </div>
                    <button onClick={() => setLinkedProduct(null)} className="size-8 rounded-full bg-white/5 hover:bg-black/10 flex items-center justify-center transition-all">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search your inventory to tag product..."
                      className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-6 text-sm font-medium focus:border-[var(--accent)] outline-none"
                    />
                    
                    {searchTerm && (
                      <div className="absolute top-full left-0 right-0 mt-3 max-h-64 overflow-y-auto bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl z-20 py-3 p-2 space-y-1">
                        {filteredProducts.length > 0 ? filteredProducts.map(p => (
                          <button
                            key={p._id}
                            onClick={() => { setLinkedProduct(p); setSearchTerm(''); }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--bg-secondary)] transition-all text-left"
                          >
                            <div className="size-10 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-white/5">
                              <img src={typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url} className="size-full object-cover" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[10px] font-black uppercase tracking-tighter truncate">{p.name}</p>
                               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60">ID: {p._id.slice(-6).toUpperCase()}</p>
                            </div>
                          </button>
                        )) : (
                          <div className="p-8 text-center opacity-30">
                            <p className="text-[10px] font-bold uppercase tracking-widest">No assets found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 flex gap-3">
                 <button 
                  onClick={() => setStep(1)}
                  className="px-8 h-14 rounded-full border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all"
                 >
                   Back
                 </button>
                 <button 
                  onClick={handlePost}
                  disabled={loading}
                  className="flex-1 h-14 bg-[var(--accent)] text-white rounded-full text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[var(--accent)]/30 disabled:opacity-30 active:scale-95 flex items-center justify-center gap-2"
                 >
                   {loading ? <Loader2 className="size-5 animate-spin" /> : <>Finalize & Post <CheckCircle2 className="size-4" /></>}
                 </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
