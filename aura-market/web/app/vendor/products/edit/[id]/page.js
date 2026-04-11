"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, Plus, Package, Image as ImageIcon,
  ArrowLeft, Star
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';

export const dynamic = 'force-dynamic';

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '',
    category: '', featured: false, specifications: '', long_description: ''
  });

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`)
        .then(res => {
          if (res.data.success) {
            const p = res.data.data.product;
            setForm({
              name: p.name || '',
              description: p.description || '',
              price: p.price || '',
              stock: p.stock || 0,
              category: p.category || '',
              featured: !!p.featured,
              specifications: p.specifications || '',
              long_description: p.long_description || ''
            });
            if (p.tags && Array.isArray(p.tags)) {
              setTags(p.tags);
            }
            if (p.images && Array.isArray(p.images)) {
              setImages(p.images.map(img => typeof img === 'string' ? { url: img, existing: true } : img));
            }
          }
        })
        .catch(err => console.error("Could not fetch product", err))
        .finally(() => setFetching(false));
    }
  }, [id]);


  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, { url: ev.target.result, file, existing: false }]);
      reader.readAsDataURL(file);
    });
  };

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      
      // Separate new and existing images
      const existingUrls = images.filter(i => i.existing).map(i => i.url);
      const newFiles = images.filter(i => !i.existing).map(i => i.file);
      
      existingUrls.forEach(url => formData.append('existing_images', url));
      newFiles.forEach(file => formData.append('images', file));
      
      formData.append('tags', JSON.stringify(tags));
      formData.append('type', 'products');
      
      await api.patch(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      router.push('/vendor/products');
    } catch (err) {
      console.error('Product update error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-screen bg-[var(--bg-secondary)] items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] relative transition-colors duration-500">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 w-full">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] relative z-10 bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--accent)]/5 transition-colors text-[var(--text-primary)]">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="h-4 w-px bg-[var(--glass-border)]" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Edit Product</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => router.back()} className="px-6 py-2 rounded-xl glass-panel text-[var(--text-secondary)] font-bold hover:bg-[var(--accent)]/5 transition-all text-sm border border-[var(--glass-border)]">
              Discard
            </button>
            <button 
              type="button"
              onClick={handleSubmit} 
              disabled={loading}
              className="px-8 py-2 rounded-xl bg-[var(--accent)] text-white font-bold shadow-xl shadow-[var(--accent)]/25 hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50 uppercase tracking-widest"
            >
              {loading ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 no-scrollbar w-full">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full">
            
            {/* ── LEFT: Product Details */}
            <div className="xl:col-span-8 space-y-8 w-full">
              
              {/* Basic Info */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Package className="w-5 h-5" /></div>
                  <h2 className="font-bold tracking-widest text-[var(--text-primary)] text-sm uppercase">Product Details</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Product Name *</label>
                    <input 
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      required
                      placeholder="e.g. Aura Pro Wireless Headphones"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Description *</label>
                    <textarea 
                      value={form.description}
                      onChange={e => setForm({...form, description: e.target.value})}
                      required
                      rows={6}
                      placeholder="Describe the craftsmanship, materials, and unique qualities of your product..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Long Description</label>
                    <textarea 
                      value={form.long_description}
                      onChange={e => setForm({...form, long_description: e.target.value})}
                      rows={8}
                      placeholder="Provide a detailed, in-depth description — materials, story, dimensions, use cases, care instructions..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Specifications</label>
                    <textarea 
                      value={form.specifications}
                      onChange={e => setForm({...form, specifications: e.target.value})}
                      rows={5}
                      placeholder="Enter specifications (one per line)..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none font-medium"
                    />
                  </div>
                </div>
              </section>

              {/* Media Upload */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><ImageIcon className="w-5 h-5" /></div>
                  <h2 className="font-bold tracking-widest text-[var(--text-primary)] text-sm uppercase">Media Assets</h2>
                  <span className="text-[10px] text-[var(--text-secondary)] ml-auto font-black uppercase tracking-widest">Max 5MB per image</span>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--glass-border)] rounded-3xl p-12 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/50 hover:bg-[var(--accent)]/5 transition-all cursor-pointer group mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-[var(--accent)]" />
                  </div>
                  <p className="font-bold text-[var(--text-primary)]">Drop product images here</p>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">or click to browse from device</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-4">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border border-[var(--glass-border)] shadow-sm">
                        <img src={img.url} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/20 transition-colors text-[var(--text-secondary)]">
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* ── RIGHT: Settings Panel */}
            <div className="xl:col-span-4 space-y-6 w-full">
              
              {/* Pricing & Inventory */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className="font-bold tracking-widest text-[var(--text-primary)] text-sm uppercase">Inventory</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Price (XAF) *</label>
                    <input 
                      type="number" min="0"
                      value={form.price}
                      onChange={e => setForm({...form, price: e.target.value})}
                      required
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Stock Quantity *</label>
                    <input 
                      type="number" min="0"
                      value={form.stock}
                      onChange={e => setForm({...form, stock: e.target.value})}
                      required
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                  </div>
                </div>
              </section>

              {/* Category & Tags */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className="font-bold tracking-widest text-[var(--text-primary)] text-sm uppercase">Organization</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Category *</label>
                    <CategoryPicker
                      value={form.category}
                      onChange={(name) => setForm({...form, category: name})}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-widest mb-2 block uppercase font-black">Tags</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl min-h-[60px]">
                      {tags.map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--text-primary)] font-bold">
                          {tag} <button type="button" onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-[var(--accent)] transition-colors"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      <input 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={addTag}
                        placeholder="Add tag..."
                        className="bg-transparent border-none outline-none text-xs text-[var(--text-primary)] font-bold min-w-[80px] focus:ring-0 px-2 placeholder:text-[var(--text-secondary)]/30"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
