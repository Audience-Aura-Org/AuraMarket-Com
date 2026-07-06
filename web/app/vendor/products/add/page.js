"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, X, Plus, Package, Image as ImageIcon,
  ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';
import { toast } from 'react-hot-toast';
import {
  MAX_PRODUCT_IMAGES,
  prepareProductImageEntries,
} from '@/lib/productImageUpload';

const getCreatedProduct = (payload) => payload?.product || payload;

const getProductImageUrl = (product) => {
  const image = product?.images?.[0];
  if (!image) return '';
  return typeof image === 'string' ? image : image.url || image.location || '';
};

const createProductWithFormData = async (formData) => {
  return await api.post('/products', formData);
};

const getProductCreateErrorMessage = (err) => {
  const code = err?.response?.data?.code;
  const status = err?.response?.status;
  if (status === 402 || code === 'SUBSCRIPTION_REQUIRED') {
    return 'Please activate a vendor package before uploading products. Go to Subscribe and choose a vendor package, then try again.';
  }
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  if (/file too large|limit_file_size|maximum size/i.test(message)) {
    return 'One or more product images are too large. Choose smaller images or let the app compress them, then try again.';
  }
  if (!err?.response) {
    return 'Mobile upload could not reach the server. Check your connection, keep the app open, and try again.';
  }
  return message || 'Failed to publish product. Please try again.';
};

export default function AddProductPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const mobileScrollYRef = useRef(0);
  const publishingRef = useRef(false);
  const storyPostingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [postingStory, setPostingStory] = useState(false);
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState(['Premium', 'Verified']);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', price: '', sale_price: '', stock: '',
    category: '', specifications: '', long_description: ''
  });
  const [showStoryPrompt, setShowStoryPrompt] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);

  // Variable Product State
  const [hasVariants, setHasVariants] = useState(false);
  const [variantTypes, setVariantTypes] = useState([{ name: 'Color', options: [], metadata: {} }]);
  const [skuVariants, setSkuVariants] = useState([]);



  const rememberMobileScroll = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    mobileScrollYRef.current = window.scrollY;
  };

  const preserveMobileScroll = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const y = mobileScrollYRef.current || window.scrollY;
    const restore = () => {
      if (Math.abs(window.scrollY - y) > 24) window.scrollTo(0, y);
    };
    window.requestAnimationFrame(restore);
    setTimeout(restore, 60);
    setTimeout(restore, 180);
  };

  const updateFormField = (field, value) => {
    rememberMobileScroll();
    setForm(prev => ({ ...prev, [field]: value }));
    preserveMobileScroll();
  };

  const handleImageFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(file => file.type?.startsWith('image/'));
    if (incoming.length === 0) {
      toast.error('Select image files from your gallery.');
      return;
    }

    const room = Math.max(0, MAX_PRODUCT_IMAGES - images.length);
    if (room === 0) {
      toast.error('You can upload up to ' + MAX_PRODUCT_IMAGES + ' product images.');
      return;
    }

    const selected = incoming.slice(0, room);
    if (incoming.length > selected.length) {
      toast.error('Only ' + MAX_PRODUCT_IMAGES + ' product images are allowed.');
    }

    try {
      const prepared = await prepareProductImageEntries(selected);
      setImages(prev => [...prev, ...prepared]);
    } catch (err) {
      toast.error(err.message || 'Could not prepare selected images.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => {
    handleImageFiles(e.target.files);
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    handleImageFiles(e.dataTransfer.files);
  };

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  const addVariantType = () => {
    setVariantTypes([...variantTypes, { name: '', options: [], metadata: {} }]);
  };

  const updateVariantType = (idx, name) => {
    const newTypes = [...variantTypes];
    newTypes[idx].name = name;
    setVariantTypes(newTypes);
  };

  const addOption = (idx, opt) => {
    if (!opt.trim()) return;
    const newTypes = [...variantTypes];
    const cleanOpt = opt.trim();
    if (newTypes[idx].options.includes(cleanOpt)) return;
    
    newTypes[idx].options.push(cleanOpt);
    
    // If it's a color, assign a default hex if not present
    if (newTypes[idx].name.toLowerCase() === 'color') {
      if (!newTypes[idx].metadata) newTypes[idx].metadata = {};
      newTypes[idx].metadata[cleanOpt] = '#000000';
    }
    
    setVariantTypes(newTypes);
    generateSKUs(newTypes);
  };

  const updateColorMetadata = (tIdx, option, color) => {
    const newTypes = [...variantTypes];
    if (!newTypes[tIdx].metadata) newTypes[tIdx].metadata = {};
    newTypes[tIdx].metadata[option] = color;
    setVariantTypes(newTypes);
  };

  const removeOption = (tIdx, oIdx) => {
    const newTypes = [...variantTypes];
    newTypes[tIdx].options.splice(oIdx, 1);
    setVariantTypes(newTypes);
    generateSKUs(newTypes);
  };

  const generateSKUs = (types) => {
    const validTypes = types.filter(t => t.name && t.options.length > 0);
    if (validTypes.length === 0) {
      setSkuVariants([]);
      return;
    }

    const combs = [];
    const helper = (depth, current) => {
      if (depth === validTypes.length) {
        combs.push({ combination: { ...current }, price: form.price || 0, sale_price: form.sale_price || '', stock: form.stock || 0 });
        return;
      }
      const type = validTypes[depth];
      type.options.forEach(opt => {
        current[type.name] = opt;
        helper(depth + 1, current);
      });
    };
    helper(0, {});
    setSkuVariants(combs);
  };

  const updateSKU = (idx, field, val) => {
    const newSkus = [...skuVariants];
    newSkus[idx][field] = val;
    setSkuVariants(newSkus);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (publishingRef.current || loading) return;

    if (!form.name.trim()) return toast.error('Product name is required.');
    if (!form.price || Number(form.price) <= 0) return toast.error('Please enter a valid price.');
    if (form.sale_price && Number(form.sale_price) >= Number(form.price)) return toast.error('Sale price must be less than the regular price.');
    if (!form.stock && form.stock !== 0) return toast.error('Stock quantity is required.');
    if (!form.category) return toast.error('Please select a category.');
    if (images.length === 0) return toast.error('At least one product image is required.');

    if (hasVariants && skuVariants.length > 0) {
      const missingPrice = skuVariants.some((v) => !v.price || Number(v.price) <= 0);
      if (missingPrice) return toast.error('All variant combinations must have a price greater than 0.');
    }

    publishingRef.current = true;
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      images.forEach(img => formData.append('images', img.file));
      formData.append('tags', JSON.stringify(tags));
      formData.append('type', 'products');
      
      if (hasVariants) {
        formData.append('has_variants', 'true');
        formData.append('variant_types', JSON.stringify(variantTypes.filter(t => t.name && t.options.length > 0)));
        formData.append('sku_variants', JSON.stringify(skuVariants));
      }

      const res = await createProductWithFormData(formData);

      toast.success(`"${form.name}" has been published!`, { icon: '🚀' });
      
      if (res.data.success) {
        setCreatedProduct(getCreatedProduct(res.data.data));
        setShowStoryPrompt(true);
      } else {
        router.push('/vendor/products');
      }
    } catch (err) {
      toast.error(getProductCreateErrorMessage(err), { duration: 7000 });
      console.error('Product creation error:', err);
    } finally {
      publishingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] relative transition-colors duration-500 md:pt-0">
      <div className="fixed top-[-10%] right-[-10%] hidden w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none md:block" />
      <div className="fixed bottom-[-10%] left-[20%] hidden w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none md:block" />

      <main
        className="flex-1 flex flex-col relative z-10 w-full"
        onPointerDownCapture={rememberMobileScroll}
        onTouchStartCapture={rememberMobileScroll}
        onBlurCapture={rememberMobileScroll}
        onFocusCapture={preserveMobileScroll}
      >
        {/* Header */}
        <header className="h-16 sm:h-20 flex items-center justify-between px-2 sm:px-4 lg:px-10 glass-panel border-b border-[var(--glass-border)] sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl text-[var(--text-primary)]">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button type="button" onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--accent)]/5 transition-colors text-[var(--text-primary)]">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="hidden h-4 w-px bg-[var(--glass-border)] sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]">List a Product</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button type="button" onClick={() => router.back()} className="hidden px-6 py-2 rounded-xl glass-panel text-[var(--text-secondary)] font-bold hover:bg-[var(--accent)]/5 transition-all text-sm border border-[var(--glass-border)] sm:inline-flex">
              Discard
            </button>
            <button 
              type="button"
              onClick={handleSubmit} 
              disabled={loading}
              className="px-3 sm:px-8 py-2 rounded-xl bg-[var(--accent)] text-white font-bold shadow-xl shadow-[var(--accent)]/25 hover:-translate-y-0.5 transition-all text-xs sm:text-sm disabled:opacity-50 tracking-tight"
            >
              {loading ? 'Publishing...' : 'Publish Product'}
            </button>
          </div>
        </header>

        <div className="flex-1 p-2 sm:p-4 lg:p-10 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-5 lg:gap-8 w-full">
            
            {/* ── LEFT: Product Details */}
            <div className="xl:col-span-8 space-y-3 sm:space-y-6 lg:space-y-8 w-full">
              
              {/* Product Type Selector */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold tracking-tight">Product Type</h2>
                      <p className="text-xs text-[var(--text-secondary)] font-medium">Select how you want to manage this product's inventory</p>
                    </div>
                  </div>
                  <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)]">
                    <button 
                      type="button"
                      onClick={() => setHasVariants(false)}
                      className={`flex-1 px-3 sm:px-6 py-2 rounded-xl text-xs font-bold tracking-tight transition-all ${!hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Simple
                    </button>
                    <button 
                      type="button"
                      onClick={() => setHasVariants(true)}
                      className={`flex-1 px-3 sm:px-6 py-2 rounded-xl text-xs font-bold tracking-tight transition-all ${hasVariants ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      Variable
                    </button>
                  </div>
                </div>
              </section>

              {/* Variations Configuration (Only if Variable is selected) */}
              {hasVariants && (
                <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                    <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Plus className="w-5 h-5" /></div>
                    <h2 className=" font-bold tracking-tight text-[var(--text-primary)] text-sm ">Configure Variations</h2>
                  </div>

                  <div className="space-y-8">
                    {/* Define Types */}
                    <div className="space-y-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] text-[var(--accent)]">1. Define Attributes (Color, Size, etc.)</h3>
                        <button 
                          type="button"
                          onClick={addVariantType}
                          className="flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--accent)] hover:bg-[var(--accent)]/5 px-3 py-1.5 rounded-lg border border-[var(--accent)]/20 transition-all"
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
                              <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">Attribute Name</label>
                              <input 
                                placeholder="e.g. Color"
                                value={type.name}
                                onChange={e => updateVariantType(tIdx, e.target.value)}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-medium placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">Options</label>
                              <div className="flex flex-wrap gap-2">
                                {type.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex flex-col gap-2">
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold  rounded-full border border-[var(--accent)]/20">
                                      {type.name.toLowerCase() === 'color' && (
                                        <div 
                                          className="size-3 rounded-full border border-black/10" 
                                          style={{ backgroundColor: type.metadata?.[opt] || '#000' }} 
                                        />
                                      )}
                                      {opt}
                                      <X className="w-3 h-3 cursor-pointer hover:scale-110" onClick={() => removeOption(tIdx, oIdx)} />
                                    </span>
                                    {type.name.toLowerCase() === 'color' && (
                                      <input 
                                        type="color" 
                                        value={type.metadata?.[opt] || '#000000'}
                                        onChange={(e) => updateColorMetadata(tIdx, opt, e.target.value)}
                                        className="w-full h-4 bg-transparent border-none cursor-pointer p-0"
                                      />
                                    )}
                                  </div>
                                ))}
                                <input 
                                  placeholder="Add option..."
                                  onKeyDown={e => { if(e.key === 'Enter') { addOption(tIdx, e.target.value); e.target.value = ''; } }}
                                  className="bg-transparent border-none outline-none text-[11px] font-normal text-[var(--text-primary)] w-24 placeholder:font-normal placeholder:text-[var(--text-secondary)]/35"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Matrix */}
                    {skuVariants.length > 0 && (
                      <div className="space-y-6">
                        <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] text-[var(--accent)]">2. Variant Matrix (Prices & Stock)</h3>
                        <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-xl shadow-black/5 sm:rounded-[2rem]">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--bg-secondary)] text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] border-b border-[var(--glass-border)]">
                              <tr>
                                <th className="p-5">Combination</th>
                                <th className="p-5 w-40">Price (Regular) (XAF)</th>
                                <th className="p-5 w-40">Sale Price (XAF)</th>
                                <th className="p-5 w-32">Stock</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs  font-bold divide-y divide-[var(--glass-border)]">
                              {skuVariants.map((sku, idx) => (
                                <tr key={idx} className="hover:bg-[var(--accent)]/5 transition-colors group">
                                  <td className="p-5">
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(sku.combination).map(([k, v]) => (
                                        <span key={k} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded-md border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)]">
                                          {k}: <span className="text-[var(--text-primary)]">{v}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <div className="relative">
                                      <input 
                                        type="number"
                                        value={sku.price}
                                        onChange={e => updateSKU(idx, 'price', e.target.value)}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <div className="relative">
                                      <input 
                                        type="number"
                                        value={sku.sale_price || ''}
                                        onChange={e => updateSKU(idx, 'sale_price', e.target.value)}
                                        placeholder="Optional"
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-5">
                                    <input 
                                      type="number"
                                      value={sku.stock}
                                      onChange={e => updateSKU(idx, 'stock', e.target.value)}
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
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
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Package className="w-5 h-5" /></div>
                  <h2 className=" font-bold tracking-tight text-[var(--text-primary)] text-sm ">Product Details</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Product Name *</label>
                    <input 
                      value={form.name}
                      onChange={e => updateFormField('name', e.target.value)}
                      required
                      placeholder="e.g. Aura Pro Wireless Headphones"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Description *</label>
                    <textarea 
                      value={form.description}
                      onChange={e => updateFormField('description', e.target.value)}
                      required
                      rows={6}
                      placeholder="Describe the craftsmanship, materials, and unique qualities of your product..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-normal text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Long Description</label>
                    <textarea 
                      value={form.long_description}
                      onChange={e => updateFormField('long_description', e.target.value)}
                      rows={8}
                      placeholder="Provide a detailed, in-depth description of your product — materials, story, dimensions, use cases, care instructions..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-normal text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Specifications</label>
                    <textarea 
                      value={form.specifications}
                      onChange={e => updateFormField('specifications', e.target.value)}
                      rows={5}
                      placeholder="Enter specifications (one per line)..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-normal text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* Media Upload */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><ImageIcon className="w-5 h-5" /></div>
                  <h2 className=" font-bold tracking-tight text-[var(--text-primary)] text-sm ">Media Assets</h2>
                  <span className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] ml-auto  font-semibold tracking-tight">Max 5MB per image</span>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  className="border-2 border-dashed border-[var(--glass-border)] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-12 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/50 hover:bg-[var(--accent)]/5 transition-all cursor-pointer group mb-4 sm:mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-[var(--accent)]" />
                  </div>
                  <p className="font-bold text-[var(--text-primary)]">Bulk upload product gallery</p>
                  <p className="text-center text-[var(--text-secondary)] text-sm mt-1">Select up to 5 images at once, or drop them here.</p>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4">
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
            <div className="xl:col-span-4 space-y-3 sm:space-y-6 w-full">
              
              {/* Pricing & Inventory */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className=" font-bold tracking-tight text-[var(--text-primary)] text-sm ">Inventory</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Price (XAF) *</label>
                    <input 
                      type="number" min="0"
                      value={form.price}
                      onChange={e => updateFormField('price', e.target.value)}
                      required
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Sale Price (XAF)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.sale_price}
                      onChange={e => updateFormField('sale_price', e.target.value)}
                      placeholder="Optional sale price"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                    <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Optional. If provided, must be less than the regular price.</p>
                  </div>
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Stock Quantity *</label>
                    <input 
                      type="number" min="0"
                      value={form.stock}
                      onChange={e => updateFormField('stock', e.target.value)}
                      required
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                  </div>
                </div>
              </section>

              {/* Category & Tags */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className=" font-bold tracking-tight text-[var(--text-primary)] text-sm ">Organization</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Category *</label>
                    <CategoryPicker
                      value={form.category}
                      onChange={(name) => updateFormField('category', name)}
                    />
                  </div>

                  <div>
                    <label className="text-xs  font-bold text-[var(--text-secondary)] tracking-tight mb-2 block   font-bold">Tags</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl min-h-[60px]">
                      {tags.map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--text-primary)]  font-bold">
                          {tag} <button type="button" onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-[var(--accent)] transition-colors"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      <input 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={addTag}
                        placeholder="Add tag..."
                        className="bg-transparent border-none outline-none text-[11px] sm:text-xs text-[var(--text-primary)] font-normal min-w-[80px] focus:ring-0 px-2 placeholder:font-normal placeholder:text-[var(--text-secondary)]/35"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Story Prompt Modal */}
      <AnimatePresence>
        {showStoryPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-[320px] w-full bg-[var(--bg-primary)] rounded-[1.75rem] border border-[var(--glass-border)] p-6 text-center shadow-2xl"
            >
              <div className="size-14 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="size-7 text-[var(--accent)]" />
              </div>
              <h3 className="text-base font-bold tracking-tight mb-1">Boost Visibility?</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
                Your product is live! Vendors who share new products as <span className="font-bold text-[var(--text-primary)]">Stories</span> see up to 3x more engagement in the first hour.
              </p>
              
              <div className="space-y-2">
                <button 
                  onClick={async () => {
                    if (storyPostingRef.current || postingStory) return;
                    const product = getCreatedProduct(createdProduct);
                    const imageUrl = getProductImageUrl(product);
                    if (!product?._id || !imageUrl) {
                       toast.error('This product needs an image before it can be posted as a story.');
                      return;
                    }

                    storyPostingRef.current = true;
                    setPostingStory(true);
                    try {
                      const expiresAt = new Date();
                      expiresAt.setDate(expiresAt.getDate() + 3);
                      await api.post('/statuses', {
                        type: 'image',
                        content_url: imageUrl,
                        thumbnail_url: imageUrl,
                        linked_product: product._id,
                        caption: `New Drop: ${product.name}`,
                        category: 'New Arrivals',
                        expiry_days: 3,
                        expires_at: expiresAt.toISOString(),
                      });
                      toast.success('Story synchronized!');
                      router.push('/vendor/products');
                    } catch (e) {
                      toast.error(e?.response?.data?.message || 'Failed to post story');
                    } finally {
                      storyPostingRef.current = false;
                      setPostingStory(false);
                    }
                  }}
                  disabled={postingStory}
                  className="w-full py-2.5 bg-[var(--accent)] text-white text-sm font-bold tracking-tight rounded-xl shadow-xl shadow-[var(--accent)]/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {postingStory ? 'Posting Story...' : 'Post as Story Now'}
                </button>
                <button 
                  onClick={() => router.push('/vendor/products')}
                  className="w-full py-2 text-xs text-[var(--text-secondary)] font-bold tracking-tight hover:text-[var(--text-primary)] transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



