"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Upload, X, Plus, Package, Image as ImageIcon,
  ArrowLeft, Loader2, Tag, Layers
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';
import { toast } from 'react-hot-toast';
import { MAX_PRODUCT_IMAGES, prepareProductImageEntries } from '@/lib/productImageUpload';

export default function AdminEditProductClient() {
  const router = useRouter();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preparingImages, setPreparingImages] = useState(false);
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', price: '', sale_price: '',
    stock: 0, category: '', featured: false, status: 'active',
    specifications: '', long_description: '',
  });

  // Variable product state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantTypes, setVariantTypes] = useState([{ name: 'Color', options: [], metadata: {} }]);
  const [skuVariants, setSkuVariants] = useState([]);

  // ── Load product ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    api.get(`/products/${id}`, { skipClientCache: true })
      .then(res => {
        if (!res.data.success) return;
        const p = res.data.data.product;
        setForm({
          name:             p.name             || '',
          description:      p.description      || '',
          price:            p.price            ?? '',
          sale_price:       p.sale_price       ?? '',
          stock:            p.stock            ?? 0,
          category:         p.category         || '',
          featured:         !!p.featured,
          status:           p.status           || 'active',
          specifications:   p.specifications   || '',
          long_description: p.long_description || '',
        });
        if (Array.isArray(p.tags)) setTags(p.tags);
        if (Array.isArray(p.images)) {
          setImages(p.images.map(img =>
            typeof img === 'string'
              ? { url: img, existing: true }
              : { url: img.url || img.location || '', file: null, existing: true }
          ));
        }
        if (p.has_variants) {
          setHasVariants(true);
          setVariantTypes(p.variant_types || [{ name: 'Color', options: [], metadata: {} }]);
          setSkuVariants(p.sku_variants || []);
        }
      })
      .catch(err => {
        console.error('Could not load product', err);
        toast.error('Failed to load product.');
      })
      .finally(() => setFetching(false));
  }, [id]);

  // ── Image handling ────────────────────────────────────────────────────────────
  const handleImageFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(f => f.type?.startsWith('image/'));
    if (!incoming.length) { toast.error('Select image files.'); return; }
    const room = Math.max(0, MAX_PRODUCT_IMAGES - images.length);
    if (room === 0) { toast.error(`Max ${MAX_PRODUCT_IMAGES} images allowed.`); return; }
    const selected = incoming.slice(0, room);
    if (incoming.length > selected.length) toast.error(`Only ${MAX_PRODUCT_IMAGES} images allowed.`);
    setPreparingImages(true);
    try {
      const prepared = await prepareProductImageEntries(selected);
      setImages(prev => [...prev, ...prepared.map(e => ({ ...e, existing: false }))]);
    } catch (err) {
      toast.error(err.message || 'Could not prepare images.');
    } finally {
      setPreparingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => handleImageFiles(e.target.files);
  const handleImageDrop  = (e) => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); };

  // ── Tag handling ──────────────────────────────────────────────────────────────
  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim();
      if (!tags.includes(t)) setTags(prev => [...prev, t]);
      setTagInput('');
    }
  };

  // ── Variant handling ──────────────────────────────────────────────────────────
  const addVariantType = () =>
    setVariantTypes(prev => [...prev, { name: '', options: [], metadata: {} }]);

  const updateVariantTypeName = (idx, name) =>
    setVariantTypes(prev => prev.map((t, i) => i === idx ? { ...t, name } : t));

  const addOption = (idx, opt) => {
    if (!opt.trim()) return;
    const clean = opt.trim();
    setVariantTypes(prev => {
      const next = prev.map((t, i) => {
        if (i !== idx) return t;
        if (t.options.includes(clean)) return t;
        const options = [...t.options, clean];
        const metadata = t.name.toLowerCase() === 'color'
          ? { ...t.metadata, [clean]: '#000000' }
          : t.metadata;
        return { ...t, options, metadata };
      });
      generateSKUs(next);
      return next;
    });
  };

  const removeOption = (tIdx, oIdx) => {
    setVariantTypes(prev => {
      const next = prev.map((t, i) => {
        if (i !== tIdx) return t;
        return { ...t, options: t.options.filter((_, j) => j !== oIdx) };
      });
      generateSKUs(next);
      return next;
    });
  };

  const updateColorMetadata = (tIdx, option, color) =>
    setVariantTypes(prev => prev.map((t, i) =>
      i === tIdx ? { ...t, metadata: { ...t.metadata, [option]: color } } : t
    ));

  const generateSKUs = (types) => {
    const valid = types.filter(t => t.name && t.options.length > 0);
    if (!valid.length) { setSkuVariants([]); return; }
    const combs = [];
    const helper = (depth, current) => {
      if (depth === valid.length) {
        const existing = skuVariants.find(sv =>
          Object.entries(current).every(([k, v]) => sv.combination?.[k] === v)
        );
        combs.push({
          combination: { ...current },
          price:      existing?.price      || form.price      || 0,
          sale_price: existing?.sale_price ?? form.sale_price ?? '',
          stock:      existing?.stock      ?? form.stock      ?? 0,
        });
        return;
      }
      valid[depth].options.forEach(opt => {
        helper(depth + 1, { ...current, [valid[depth].name]: opt });
      });
    };
    helper(0, {});
    setSkuVariants(combs);
  };

  const updateSKU = (idx, field, val) =>
    setSkuVariants(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (loading || preparingImages) return;
    if (!form.name.trim()) return toast.error('Product name is required.');
    if (!form.price || Number(form.price) <= 0) return toast.error('Please enter a valid price.');
    if (form.sale_price && Number(form.sale_price) >= Number(form.price))
      return toast.error('Sale price must be less than the regular price.');
    if (!form.category) return toast.error('Please select a category.');

    setLoading(true);
    try {
      const fd = new FormData();

      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });

      images.filter(i =>  i.existing).forEach(i => fd.append('existing_images', i.url));
      images.filter(i => !i.existing).forEach(i => fd.append('images', i.file));

      fd.append('tags', JSON.stringify(tags));

      if (hasVariants) {
        fd.append('has_variants', 'true');
        fd.append('variant_types', JSON.stringify(
          variantTypes.filter(t => t.name && t.options.length > 0)
        ));
        fd.append('sku_variants', JSON.stringify(skuVariants));
      } else {
        fd.append('has_variants', 'false');
      }

      await api.patch(`/admin/products/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Product updated.');
      router.push('/admin/products');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update product.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="flex h-full items-center justify-center py-40">
        <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="min-h-16 py-3 flex items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/admin/products')}
            className="size-9 flex items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Admin — Product Edit</p>
            <h1 className="text-base font-bold tracking-tight text-[var(--text-primary)] truncate">{form.name || 'Edit Product'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push('/admin/products')}
            className="hidden md:inline-flex h-9 items-center px-4 rounded-xl border border-[var(--glass-border)] text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || preparingImages}
            className="h-9 flex items-center gap-2 px-5 rounded-xl bg-[var(--accent)] text-white text-[11px] font-bold shadow-lg disabled:opacity-50 transition-all"
          >
            {(loading || preparingImages) && <Loader2 className="size-3 animate-spin" />}
            {loading ? 'Saving…' : preparingImages ? 'Preparing…' : 'Save Product'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-10 pb-32 space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* ── LEFT ── */}
            <div className="xl:col-span-8 space-y-5">

              {/* Product Type */}
              <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Package className="size-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Product Type</p>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] opacity-70">Choose how inventory is tracked</p>
                    </div>
                  </div>
                  <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)]">
                    <button
                      type="button"
                      onClick={() => { setHasVariants(false); setSkuVariants([]); }}
                      className={`flex-1 px-5 py-2 rounded-xl text-[11px] font-bold tracking-tight transition-all ${!hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasVariants(true)}
                      className={`flex-1 px-5 py-2 rounded-xl text-[11px] font-bold tracking-tight transition-all ${hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Variable
                    </button>
                  </div>
                </div>
              </section>

              {/* Variations */}
              {hasVariants && (
                <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-[var(--glass-border)]">
                    <div className="size-9 flex items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Layers className="size-4" />
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Configure Variations</p>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">1. Define Attributes</p>
                      <button
                        type="button"
                        onClick={addVariantType}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[var(--accent)]/20 text-[var(--accent)] text-[11px] font-bold hover:bg-[var(--accent)]/5 transition-all"
                      >
                        <Plus className="size-3" /> Add Attribute
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {variantTypes.map((type, tIdx) => (
                        <div key={tIdx} className="relative p-5 bg-[var(--bg-secondary)]/60 rounded-2xl border border-[var(--glass-border)] space-y-4 group">
                          <button
                            type="button"
                            onClick={() => {
                              const next = variantTypes.filter((_, i) => i !== tIdx);
                              setVariantTypes(next);
                              generateSKUs(next);
                            }}
                            className="absolute top-4 right-4 size-7 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="size-3.5" />
                          </button>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/55 block mb-1.5">Attribute Name</label>
                            <input
                              placeholder="e.g. Color, Size"
                              value={type.name}
                              onChange={e => updateVariantTypeName(tIdx, e.target.value)}
                              className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[13px] font-semibold placeholder:font-normal outline-none focus:border-[var(--accent)]/45"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/55 block mb-1.5">Options</label>
                            <div className="flex flex-wrap gap-2 min-h-[36px]">
                              {type.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex flex-col gap-1.5">
                                  <span className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-semibold rounded-full border border-[var(--accent)]/20">
                                    {type.name.toLowerCase() === 'color' && (
                                      <div className="size-3 rounded-full border border-black/10" style={{ backgroundColor: type.metadata?.[opt] || '#000' }} />
                                    )}
                                    {opt}
                                    <button type="button" onClick={() => removeOption(tIdx, oIdx)}>
                                      <X className="size-3 cursor-pointer hover:scale-110" />
                                    </button>
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
                                placeholder="Add option…"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(tIdx, e.target.value); e.target.value = ''; } }}
                                className="bg-transparent border-none outline-none text-[11px] font-normal text-[var(--text-primary)] w-24 placeholder:font-normal placeholder:text-[var(--text-secondary)]/35"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SKU Matrix */}
                  {skuVariants.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">2. Variant Matrix — Prices &amp; Stock</p>
                      <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-[var(--bg-secondary)]/60 border-b border-[var(--glass-border)]">
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/55">
                              <th className="px-5 py-3">Combination</th>
                              <th className="px-5 py-3 w-36">Price (XAF)</th>
                              <th className="px-5 py-3 w-36">Sale Price</th>
                              <th className="px-5 py-3 w-28">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--glass-border)]">
                            {skuVariants.map((sku, idx) => (
                              <tr key={idx} className="hover:bg-[var(--accent)]/5 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(sku.combination).map(([k, v]) => (
                                      <span key={k} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded-md border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)]">
                                        {k}: <span className="text-[var(--text-primary)]">{v}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  <input type="number" value={sku.price} onChange={e => updateSKU(idx, 'price', e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[13px] font-semibold outline-none focus:border-[var(--accent)]/45" />
                                </td>
                                <td className="px-5 py-3">
                                  <input type="number" value={sku.sale_price || ''} onChange={e => updateSKU(idx, 'sale_price', e.target.value)}
                                    placeholder="Optional"
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[13px] font-semibold placeholder:font-normal outline-none focus:border-[var(--accent)]/45" />
                                </td>
                                <td className="px-5 py-3">
                                  <input type="number" value={sku.stock} onChange={e => updateSKU(idx, 'stock', e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[13px] font-semibold outline-none focus:border-[var(--accent)]/45" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Product Details */}
              <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-[var(--glass-border)]">
                  <div className="size-9 flex items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Package className="size-4" />
                  </div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Product Details</p>
                </div>

                <FieldRow label="Product Name *">
                  <AInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Wireless Headphones Pro" />
                </FieldRow>

                <FieldRow label="Description *">
                  <ATextarea value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} rows={5} placeholder="Describe the product…" />
                </FieldRow>

                <FieldRow label="Long Description">
                  <ATextarea value={form.long_description} onChange={v => setForm(f => ({ ...f, long_description: v }))} rows={7} placeholder="In-depth details, materials, care instructions…" />
                </FieldRow>

                <FieldRow label="Specifications">
                  <ATextarea value={form.specifications} onChange={v => setForm(f => ({ ...f, specifications: v }))} rows={4} placeholder="One specification per line…" />
                </FieldRow>
              </section>

              {/* Media */}
              <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--glass-border)]">
                  <div className="size-9 flex items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                    <ImageIcon className="size-4" />
                  </div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Media Assets</p>
                  <span className="ml-auto text-[10px] font-semibold text-[var(--text-secondary)] opacity-55">Max 5MB per image</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleImageDrop}
                  className="border-2 border-dashed border-[var(--glass-border)] rounded-2xl p-8 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/40 hover:bg-[var(--accent)]/5 transition-all cursor-pointer group mb-5"
                >
                  <div className="size-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="size-7 text-[var(--accent)]" />
                  </div>
                  <p className="font-bold text-[13px] text-[var(--text-primary)]">Upload product images</p>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-60 mt-1">Click or drag &amp; drop — up to 5 images</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border border-[var(--glass-border)]">
                        <img src={img.url} alt="" className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white">Cover</span>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-2xl border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/30 transition-colors text-[var(--text-secondary)]"
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* ── RIGHT ── */}
            <div className="xl:col-span-4 space-y-5">

              {/* Status + Admin Controls */}
              <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)] pb-3 border-b border-[var(--glass-border)]">Admin Controls</p>
                <FieldRow label="Status">
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 text-[13px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/45"
                  >
                    <option value="active">Approved / Active</option>
                    <option value="pending">Pending</option>
                    <option value="archived">Disapproved / Archived</option>
                    <option value="suspended">Suspended</option>
                    <option value="draft">Draft</option>
                  </select>
                </FieldRow>
                <label className="flex h-11 items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 cursor-pointer">
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">Featured</span>
                  <input
                    type="checkbox"
                    checked={!!form.featured}
                    onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                    className="size-5 accent-[var(--accent)]"
                  />
                </label>
              </section>

              {/* Pricing & Inventory — only for simple products */}
              {!hasVariants && (
                <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)] pb-3 border-b border-[var(--glass-border)]">Pricing &amp; Inventory</p>
                  <FieldRow label="Price (XAF) *">
                    <AInput type="number" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="0" />
                  </FieldRow>
                  <FieldRow label="Sale Price (XAF)">
                    <AInput type="number" value={form.sale_price} onChange={v => setForm(f => ({ ...f, sale_price: v }))} placeholder="Optional" />
                  </FieldRow>
                  <FieldRow label="Stock Quantity *">
                    <AInput type="number" value={form.stock} onChange={v => setForm(f => ({ ...f, stock: v }))} placeholder="0" />
                  </FieldRow>
                </section>
              )}

              {/* Pricing (base price only) for variable products */}
              {hasVariants && (
                <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)] pb-3 border-b border-[var(--glass-border)]">Base Price (XAF) *</p>
                  <FieldRow label="Base Price">
                    <AInput type="number" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="0" />
                  </FieldRow>
                  <p className="text-[10px] text-[var(--text-secondary)] opacity-55 font-semibold leading-relaxed">Base price is used as a default for new variant rows. Each variant can have its own price in the matrix above.</p>
                </section>
              )}

              {/* Category & Tags */}
              <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-5 md:p-7 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)] pb-3 border-b border-[var(--glass-border)]">Organisation</p>
                <FieldRow label="Category *">
                  <CategoryPicker value={form.category} onChange={name => setForm(f => ({ ...f, category: name }))} />
                </FieldRow>
                <FieldRow label="Tags">
                  <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl min-h-[52px]">
                    {tags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[11px] font-bold text-[var(--text-primary)]">
                        <Tag className="size-2.5" />
                        {tag}
                        <button type="button" onClick={() => setTags(prev => prev.filter((_, j) => j !== i))}>
                          <X className="size-3 hover:text-[var(--accent)]" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      placeholder="Add tag…"
                      className="bg-transparent border-none outline-none text-[11px] font-normal min-w-[80px] placeholder:font-normal placeholder:text-[var(--text-secondary)]/35"
                    />
                  </div>
                </FieldRow>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function FieldRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/55 block">{label}</label>
      {children}
    </div>
  );
}

function AInput({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 text-[13px] font-semibold text-[var(--text-primary)] placeholder:font-normal outline-none focus:border-[var(--accent)]/45 transition-colors"
    />
  );
}

function ATextarea({ value, onChange, rows = 4, placeholder = '' }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] font-semibold text-[var(--text-primary)] placeholder:font-normal outline-none focus:border-[var(--accent)]/45 transition-colors"
    />
  );
}
