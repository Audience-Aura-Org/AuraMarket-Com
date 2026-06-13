"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Upload, X, Plus, Package, Image as ImageIcon,
  ArrowLeft
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';
import { toast } from 'react-hot-toast';

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
    name: '', description: '', price: '', sale_price: '',
    stock: 0, category: '', featured: false,
    specifications: '', long_description: ''
  });

  // Variable Product State
  const [hasVariants, setHasVariants] = useState(false);
  const [variantTypes, setVariantTypes] = useState([{ name: 'Color', options: [], metadata: {} }]);
  const [skuVariants, setSkuVariants] = useState([]);

  // ── Load product ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    // skipClientCache: always fetch from the server so the edit form
    // never shows stale sale_price / field values from the 45-second
    // localStorage client cache.
    api.get(`/products/${id}`, { skipClientCache: true })
      .then(res => {
        if (!res.data.success) return;
        const p = res.data.data.product;
        setForm({
          name:             p.name             || '',
          description:      p.description      || '',
          price:            p.price            ?? '',
          // Use ?? so a genuine null sale_price becomes '' (not 'null')
          sale_price:       p.sale_price       ?? '',
          stock:            p.stock            ?? 0,
          category:         p.category         || '',
          featured:         !!p.featured,
          specifications:   p.specifications   || '',
          long_description: p.long_description || ''
        });
        if (Array.isArray(p.tags))   setTags(p.tags);
        if (Array.isArray(p.images)) {
          setImages(p.images.map(img =>
            typeof img === 'string' ? { url: img, existing: true } : img
          ));
        }
        if (p.has_variants) {
          setHasVariants(true);
          setVariantTypes(p.variant_types || [{ name: 'Color', options: [], metadata: {} }]);
          setSkuVariants(p.sku_variants  || []);
        }
      })
      .catch(err => console.error('Could not fetch product', err))
      .finally(() => setFetching(false));
  }, [id]);

  // ── Image handling ──────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setImages(prev => [...prev, { url: ev.target.result, file, existing: false }]);
      reader.readAsDataURL(file);
    });
  };

  // ── Tag handling ────────────────────────────────────────────────────────────
  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  // ── Variant handling ────────────────────────────────────────────────────────
  const addVariantType = () =>
    setVariantTypes([...variantTypes, { name: '', options: [], metadata: {} }]);

  const updateVariantType = (idx, name) => {
    const next = [...variantTypes];
    next[idx].name = name;
    setVariantTypes(next);
  };

  const addOption = (idx, opt) => {
    if (!opt.trim()) return;
    const next = [...variantTypes];
    const clean = opt.trim();
    if (next[idx].options.includes(clean)) return;
    next[idx].options.push(clean);
    if (next[idx].name.toLowerCase() === 'color') {
      if (!next[idx].metadata) next[idx].metadata = {};
      next[idx].metadata[clean] = '#000000';
    }
    setVariantTypes(next);
    generateSKUs(next);
  };

  const updateColorMetadata = (tIdx, option, color) => {
    const next = [...variantTypes];
    if (!next[tIdx].metadata) next[tIdx].metadata = {};
    next[tIdx].metadata[option] = color;
    setVariantTypes(next);
  };

  const removeOption = (tIdx, oIdx) => {
    const next = [...variantTypes];
    next[tIdx].options.splice(oIdx, 1);
    setVariantTypes(next);
    generateSKUs(next);
  };

  const generateSKUs = (types) => {
    const valid = types.filter(t => t.name && t.options.length > 0);
    if (!valid.length) { setSkuVariants([]); return; }
    const combs = [];
    const helper = (depth, current) => {
      if (depth === valid.length) {
        const existing = skuVariants.find(sv =>
          Object.entries(current).every(([k, v]) => sv.combination[k] === v)
        );
        combs.push({
          combination: { ...current },
          price: existing?.price || form.price || 0,
          stock: existing?.stock || form.stock || 0
        });
        return;
      }
      valid[depth].options.forEach(opt => {
        current[valid[depth].name] = opt;
        helper(depth + 1, current);
      });
    };
    helper(0, {});
    setSkuVariants(combs);
  };

  const updateSKU = (idx, field, val) => {
    const next = [...skuVariants];
    next[idx][field] = val;
    setSkuVariants(next);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.price || Number(form.price) <= 0)
      return toast.error('Please enter a valid price.');
    if (form.sale_price && Number(form.sale_price) >= Number(form.price))
      return toast.error('Sale price must be lower than the regular price.');

    setLoading(true);
    try {
      const formData = new FormData();

      // Safe append — skip null/undefined so they never arrive at the backend
      // as the string "null"/"undefined" (FormData.append coerces everything).
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, v);
      });

      // Images — existing URLs and new file uploads
      images.filter(i =>  i.existing).forEach(i  => formData.append('existing_images', i.url));
      images.filter(i => !i.existing).forEach(i  => formData.append('images', i.file));

      formData.append('tags', JSON.stringify(tags));
      formData.append('type', 'products');

      if (hasVariants) {
        formData.append('has_variants', 'true');
        formData.append('variant_types', JSON.stringify(
          variantTypes.filter(t => t.name && t.options.length > 0)
        ));
        formData.append('sku_variants', JSON.stringify(skuVariants));
      } else {
        formData.append('has_variants', 'false');
      }

      await api.patch(`/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Bust client-side localStorage cache for all product routes so the
      // vendor products list and product detail cards immediately reflect
      // the updated sale_price / on_sale without waiting for the 45 s TTL.
      try {
        const storage = window.localStorage;
        const toRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith('aura_api_cache:') && k.includes('products'))
            toRemove.push(k);
        }
        toRemove.forEach(k => storage.removeItem(k));
      } catch { /* non-fatal */ }

      toast.success('Product updated successfully.');
      router.push('/vendor/products');
    } catch (err) {
      console.error('Product update error:', err);
      toast.error(err?.response?.data?.message || 'Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex h-screen bg-[var(--bg-secondary)] items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Page ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative transition-colors duration-500">
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col relative z-10 w-full">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl text-[var(--text-primary)]">
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
              className="px-8 py-2 rounded-xl bg-[var(--accent)] text-white font-bold shadow-xl shadow-[var(--accent)]/25 hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50 tracking-tight"
            >
              {loading ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </header>

        <div className="flex-1 p-10 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full">

            {/* ── LEFT: Product Details */}
            <div className="xl:col-span-8 space-y-8 w-full">

              {/* Product Type Selector */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">Product Type</h2>
                      <p className="text-xs text-[var(--text-secondary)] font-medium">Select how you want to manage this product&apos;s inventory</p>
                    </div>
                  </div>
                  <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)]">
                    <button
                      type="button"
                      onClick={() => setHasVariants(false)}
                      className={`px-6 py-2 rounded-xl text-xs font-bold tracking-tight transition-all ${!hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasVariants(true)}
                      className={`px-6 py-2 rounded-xl text-xs font-bold tracking-tight transition-all ${hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Variable
                    </button>
                  </div>
                </div>
              </section>

              {/* Variations Configuration */}
              {hasVariants && (
                <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                    <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Plus className="w-5 h-5" /></div>
                    <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Configure Variations</h2>
                  </div>

                  <div className="space-y-8">
                    {/* Define Attributes */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] lg:text-[12px] font-semibold tracking-[0.2em] text-[var(--accent)]">1. Define Attributes (Color, Size, etc.)</h3>
                        <button
                          type="button"
                          onClick={addVariantType}
                          className="flex items-center gap-2 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--accent)] hover:bg-[var(--accent)]/5 px-3 py-1.5 rounded-lg border border-[var(--accent)]/20 transition-all"
                        >
                          <Plus className="w-3 h-3" /> Add Attribute
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {variantTypes.map((type, tIdx) => (
                          <div key={tIdx} className="p-6 bg-[var(--bg-secondary)]/50 rounded-3xl border border-[var(--glass-border)] space-y-4 relative group">
                            <button
                              type="button"
                              onClick={() => setVariantTypes(prev => prev.filter((_, i) => i !== tIdx))}
                              className="absolute top-4 right-4 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="space-y-1">
                              <label className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">Attribute Name</label>
                              <input
                                placeholder="e.g. Color"
                                value={type.name}
                                onChange={e => updateVariantType(tIdx, e.target.value)}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">Options</label>
                              <div className="flex flex-wrap gap-2">
                                {type.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex flex-col gap-2">
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px] font-semibold rounded-full border border-[var(--accent)]/20">
                                      {type.name.toLowerCase() === 'color' && (
                                        <div className="size-3 rounded-full border border-black/10" style={{ backgroundColor: type.metadata?.[opt] || '#000' }} />
                                      )}
                                      {opt}
                                      <X className="w-3 h-3 cursor-pointer hover:scale-110" onClick={() => removeOption(tIdx, oIdx)} />
                                    </span>
                                    {type.name.toLowerCase() === 'color' && (
                                      <input
                                        type="color"
                                        value={type.metadata?.[opt] || '#000000'}
                                        onChange={e => updateColorMetadata(tIdx, opt, e.target.value)}
                                        className="w-full h-4 bg-transparent border-none cursor-pointer p-0"
                                      />
                                    )}
                                  </div>
                                ))}
                                <input
                                  placeholder="Add option..."
                                  onKeyDown={e => { if (e.key === 'Enter') { addOption(tIdx, e.target.value); e.target.value = ''; } }}
                                  className="bg-transparent border-none outline-none text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)] w-24 placeholder:text-[var(--text-secondary)]/30"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SKU Matrix */}
                    {skuVariants.length > 0 && (
                      <div className="space-y-6">
                        <h3 className="text-[11px] lg:text-[12px] font-semibold tracking-[0.2em] text-[var(--accent)]">2. Variant Matrix (Prices &amp; Stock)</h3>
                        <div className="overflow-hidden border border-[var(--glass-border)] rounded-[2rem] bg-[var(--bg-primary)] shadow-xl shadow-black/5">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--bg-secondary)] text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] border-b border-[var(--glass-border)]">
                              <tr>
                                <th className="p-5">Combination</th>
                                <th className="p-5 w-40">Price (XAF)</th>
                                <th className="p-5 w-32">Stock</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold divide-y divide-[var(--glass-border)]">
                              {skuVariants.map((sku, idx) => (
                                <tr key={idx} className="hover:bg-[var(--accent)]/5 transition-colors group">
                                  <td className="p-5">
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(sku.combination).map(([k, v]) => (
                                        <span key={k} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded-md border border-[var(--glass-border)] text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)]">
                                          {k}: <span className="text-[var(--text-primary)]">{v}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <input
                                      type="number"
                                      value={sku.price}
                                      onChange={e => updateSKU(idx, 'price', e.target.value)}
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                    />
                                  </td>
                                  <td className="p-5">
                                    <input
                                      type="number"
                                      value={sku.stock}
                                      onChange={e => updateSKU(idx, 'stock', e.target.value)}
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Basic Info */}
              <section className="p-8 rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Package className="w-5 h-5" /></div>
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Product Details</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Product Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="e.g. Aura Pro Wireless Headphones"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Description *</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      required
                      rows={6}
                      placeholder="Describe the craftsmanship, materials, and unique qualities of your product..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Long Description</label>
                    <textarea
                      value={form.long_description}
                      onChange={e => setForm({ ...form, long_description: e.target.value })}
                      rows={8}
                      placeholder="Provide a detailed, in-depth description — materials, story, dimensions, use cases, care instructions..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Specifications</label>
                    <textarea
                      value={form.specifications}
                      onChange={e => setForm({ ...form, specifications: e.target.value })}
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Media Assets</h2>
                  <span className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] ml-auto font-semibold tracking-tight">Max 5MB per image</span>
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
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Inventory</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Price (XAF) *</label>
                    <input
                      type="number" min="0"
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                      required
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Sale Price (XAF)</label>
                    <input
                      type="number" min="0"
                      value={form.sale_price}
                      onChange={e => setForm({ ...form, sale_price: e.target.value })}
                      placeholder="Optional discount price"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-bold"
                    />
                    <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Optional. Must be lower than the regular price.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Stock Quantity *</label>
                    <input
                      type="number" min="0"
                      value={form.stock}
                      onChange={e => setForm({ ...form, stock: e.target.value })}
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Organization</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Category *</label>
                    <CategoryPicker
                      value={form.category}
                      onChange={name => setForm({ ...form, category: name })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Tags</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl min-h-[60px]">
                      {tags.map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--text-primary)] font-bold">
                          {tag}
                          <button type="button" onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-[var(--accent)] transition-colors">
                            <X className="w-3 h-3" />
                          </button>
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
