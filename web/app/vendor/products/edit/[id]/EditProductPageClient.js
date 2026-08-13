"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Upload, X, Plus, Package, Image as ImageIcon,
  ArrowLeft, Utensils, ShoppingBag, CalendarClock, Check,
} from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';
import { toast } from 'react-hot-toast';
import {
  MAX_PRODUCT_IMAGES,
  prepareProductImageEntries,
} from '@/lib/productImageUpload';

const MEAL_BOOKING_MODES = [
  { value: 'delivery',  label: 'Delivery',  icon: ShoppingBag   },
  { value: 'pickup',    label: 'Pickup',    icon: Package       },
  { value: 'dine_in',   label: 'Dine-In',  icon: Utensils      },
  { value: 'pre_order', label: 'Pre-Order', icon: CalendarClock },
];

const PREP_UNITS = [
  { value: 'minutes', label: 'Mins',  factor: 1     },
  { value: 'hours',   label: 'Hours', factor: 60    },
  { value: 'days',    label: 'Days',  factor: 1440  },
  { value: 'weeks',   label: 'Weeks', factor: 10080 },
];

function minutesToDisplay(mins) {
  if (!mins) return { value: '', unit: 'minutes' };
  if (mins % 10080 === 0) return { value: String(mins / 10080), unit: 'weeks' };
  if (mins % 1440  === 0) return { value: String(mins / 1440),  unit: 'days'  };
  if (mins % 60    === 0) return { value: String(mins / 60),    unit: 'hours' };
  return { value: String(mins), unit: 'minutes' };
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  // Support both ?id=xxx (static APK route) and /edit/[id] (dynamic web route)
  const id = searchParams?.get('id') || params?.id;
  const fileInputRef = useRef(null);
  const mobileScrollYRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [preparingImages, setPreparingImages] = useState(false);
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
  const [optionInputs, setOptionInputs] = useState({});

  const [parcelClass, setParcelClass] = useState('small'); // 'small' | 'oversize'

  // Meal / Food item state
  const [isRestaurantVendor, setIsRestaurantVendor] = useState(false);
  const [isMeal, setIsMeal] = useState(false);
  const [mealBookingOptions, setMealBookingOptions] = useState(['delivery']);
  const [prepTimeValue, setPrepTimeValue] = useState('');
  const [prepTimeUnit, setPrepTimeUnit] = useState('minutes');

  // Option groups (meal customisation — Sauce, Size, Add-ons, etc.)
  const [optionGroups, setOptionGroups] = useState([]);
  const addOptionGroup    = () => setOptionGroups(prev => [...prev, { name: '', is_required: false, min_select: 1, max_select: 1, options: [] }]);
  const removeOptionGroup = (gi) => setOptionGroups(prev => prev.filter((_, i) => i !== gi));
  const updateOptionGroup = (gi, field, val) => setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, [field]: val } : g));
  const addGroupOption    = (gi) => setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: [...g.options, { label: '', price_delta: 0, is_default: false, is_available: true }] } : g));
  const updateGroupOption = (gi, oi, field, val) => setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, [field]: val } : o) } : g));
  const removeGroupOption = (gi, oi) => setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g));

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
          setSkuVariants(p.sku_variants  || []);
        }
        if (p.meal || p.is_meal) {
          setIsMeal(true);
          const opts = (p.meal?.booking_options || []).map(o =>
            typeof o === 'string' ? o : o.type
          ).filter(Boolean);
          if (opts.length) setMealBookingOptions(opts);
          if (p.meal?.prep_time_minutes) {
            const { value, unit } = minutesToDisplay(p.meal.prep_time_minutes);
            setPrepTimeValue(value);
            setPrepTimeUnit(unit);
          }
          if (Array.isArray(p.meal?.option_groups)) setOptionGroups(p.meal.option_groups);
        }
        setParcelClass(p.parcel_class || 'small');
      })
      .catch(err => console.error('Could not fetch product', err))
      .finally(() => setFetching(false));
  }, [id]);

  // ── Detect restaurant vendor ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/vendors/me')
      .then(res => {
        if (res.data?.data?.vendor?.vendor_type === 'restaurant') {
          setIsRestaurantVendor(true);
          setIsMeal(true);
        }
      })
      .catch(() => {});
  }, []);

  // ── Mobile scroll preservation ──────────────────────────────────────────────
  const rememberMobileScroll = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    mobileScrollYRef.current = window.scrollY;
  };

  const preserveMobileScroll = () => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const y = mobileScrollYRef.current;
    if (!y) return;
    // Only use rAF (fires in the same paint cycle) — setTimeout delays cause the
    // restore to fire after the user has already scrolled to a new field, snapping
    // them back to the previous position (and often to the top of the page).
    window.requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 24) window.scrollTo(0, y);
    });
  };

  const updateFormField = (field, value) => {
    rememberMobileScroll();
    setForm(prev => ({ ...prev, [field]: value }));
    preserveMobileScroll();
  };

  // ── Image handling ──────────────────────────────────────────────────────────
  const handleImageFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(f => f.type?.startsWith('image/'));
    if (!incoming.length) {
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

    setPreparingImages(true);
    try {
      const prepared = await prepareProductImageEntries(selected);
      setImages(prev => [...prev, ...prepared.map(e => ({ ...e, existing: false }))]);
    } catch (err) {
      toast.error(err.message || 'Could not prepare selected images.');
    } finally {
      setPreparingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => handleImageFiles(e.target.files);
  const handleImageDrop = (e) => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); };

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

  const handleAddOption = (tIdx) => {
    const val = (optionInputs[tIdx] || '').trim();
    if (!val) return;
    addOption(tIdx, val);
    setOptionInputs(prev => ({ ...prev, [tIdx]: '' }));
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
          price:      existing?.price      || form.price      || 0,
          sale_price: existing?.sale_price || form.sale_price || '',
          stock:      existing?.stock      || form.stock      || 0,
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

  const toggleMealBookingMode = (value) => {
    setMealBookingOptions(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || preparingImages) return;

    if (!form.name.trim()) return toast.error('Product name is required.');
    if (!hasVariants && (!form.price || Number(form.price) <= 0))
      return toast.error('Please enter a valid price.');
    if (!hasVariants && form.sale_price && Number(form.sale_price) >= Number(form.price))
      return toast.error('Sale price must be less than the regular price.');
    if (!form.category) return toast.error('Please select a category.');
    if (isMeal && !mealBookingOptions.length) return toast.error('Select at least one order mode for this meal.');

    setLoading(true);
    try {
      const formData = new FormData();

      // Safe append — skip null/undefined so they never arrive at the backend
      // as the string "null"/"undefined" (FormData.append coerces everything).
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, v);
      });

      // Images — existing URLs and new optimized file uploads
      images.filter(i =>  i.existing).forEach(i => formData.append('existing_images', i.url));
      images.filter(i => !i.existing).forEach(i => formData.append('images', i.file));

      formData.append('tags', JSON.stringify(tags));
      formData.append('type', 'products');
      formData.append('parcel_class', parcelClass);

      if (hasVariants) {
        formData.append('has_variants', 'true');
        formData.append('variant_types', JSON.stringify(
          variantTypes.filter(t => t.name && t.options.length > 0)
        ));
        formData.append('sku_variants', JSON.stringify(skuVariants));
      } else {
        formData.append('has_variants', 'false');
      }

      if (isMeal) {
        formData.append('is_meal', 'true');
        formData.append('meal', JSON.stringify({
          booking_options:   mealBookingOptions.map(v => ({ type: v })),
          prep_time_minutes: prepTimeValue
            ? Number(prepTimeValue) * (PREP_UNITS.find(u => u.value === prepTimeUnit)?.factor ?? 1)
            : null,
          option_groups:     optionGroups,
        }));
      } else {
        formData.append('is_meal', 'false');
      }

      await api.patch(`/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Bust client-side localStorage cache for all product routes so the
      // vendor products list immediately reflects the updated values.
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
    <div className="min-h-screen overflow-x-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] relative transition-colors duration-500 md:pt-0">
      <div className="fixed top-[-10%] right-[-10%] hidden w-[500px] h-[500px] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none md:block" />
      <div className="fixed bottom-[-10%] left-[20%] hidden w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none md:block" />

      <main
        className="flex-1 flex flex-col relative z-10 w-full"
        onPointerDownCapture={rememberMobileScroll}
        onTouchStartCapture={rememberMobileScroll}
        onBlurCapture={rememberMobileScroll}
      >
        {/* Header */}
        <header className="h-16 sm:h-20 flex items-center justify-between px-2 sm:px-4 lg:px-10 glass-panel border-b border-[var(--glass-border)] sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl text-[var(--text-primary)]">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button type="button" onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--accent)]/5 transition-colors text-[var(--text-primary)]">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="hidden h-4 w-px bg-[var(--glass-border)] sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]">Edit Product</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button type="button" onClick={() => router.back()} className="hidden px-6 py-2 rounded-xl glass-panel text-[var(--text-secondary)] font-bold hover:bg-[var(--accent)]/5 transition-all text-sm border border-[var(--glass-border)] sm:inline-flex">
              Discard
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || preparingImages}
              className="px-3 sm:px-8 py-2 rounded-xl bg-[var(--accent)] text-white font-bold shadow-xl shadow-[var(--accent)]/25 hover:-translate-y-0.5 transition-all text-xs sm:text-sm disabled:opacity-50 tracking-tight"
            >
              {loading ? 'Updating...' : preparingImages ? 'Preparing...' : 'Update Product'}
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
                      <p className="text-xs text-[var(--text-secondary)] font-medium">Select how you want to manage this product&apos;s inventory</p>
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

              {/* Meal toggle — hidden for restaurant vendors (all their products are meals) */}
              {!isRestaurantVendor && (
                <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--glass-border)]">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Meal / Food Item</h2>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer transition-all ${isMeal ? 'border-orange-500/40 bg-orange-500/8' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}
                    onClick={() => setIsMeal(v => !v)}
                  >
                    <div className="flex items-center gap-3">
                      <Utensils className={`w-4 h-4 ${isMeal ? 'text-orange-500' : 'text-[var(--text-secondary)] opacity-40'}`} />
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)]">This is a food / meal item</p>
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-60">Enable booking modes and prep time</p>
                      </div>
                    </div>
                    <div className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${isMeal ? 'bg-orange-500 border-orange-500' : 'bg-[var(--bg-primary)] border-[var(--glass-border)]'}`}>
                      <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${isMeal ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </section>
              )}

              {/* Meal fields (prep time + order modes) */}
              {(isMeal || isRestaurantVendor) && (
                <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-orange-500/20 bg-orange-500/5 animate-in fade-in slide-in-from-top-4 duration-300 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-orange-500/15">
                    <Utensils className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-bold text-orange-600">Meal Details</h2>
                  </div>

                  {/* Prep Time */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      Prep Time <span className="font-normal opacity-60">— how long to prepare this item</span>
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min="0"
                        value={prepTimeValue}
                        onChange={e => setPrepTimeValue(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-24 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-3 py-3 text-[12px] font-medium outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {PREP_UNITS.map(u => (
                          <button
                            key={u.value}
                            type="button"
                            onClick={() => setPrepTimeUnit(u.value)}
                            className={`px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                              prepTimeUnit === u.value
                                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-orange-500/30'
                            }`}
                          >
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-60 leading-relaxed">
                      Leave blank to use your restaurant&apos;s default prep time. Set a value here to override it for this item only.
                    </p>
                  </div>

                  {/* Order modes */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Order Modes *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {MEAL_BOOKING_MODES.map(mode => {
                        const Icon = mode.icon;
                        const selected = mealBookingOptions.includes(mode.value);
                        return (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => toggleMealBookingMode(mode.value)}
                            className={`flex flex-col items-center gap-2 rounded-xl border py-3 px-2 text-[11px] font-bold transition-all active:scale-95 ${
                              selected
                                ? 'border-orange-500/50 bg-orange-500/10 text-orange-600'
                                : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <Icon className={`size-4 ${selected ? 'text-orange-500' : 'opacity-40'}`} />
                            {mode.label}
                            {selected && <Check className="size-3 text-orange-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* Variations Configuration */}
              {hasVariants && (
                <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                    <div className="p-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]"><Plus className="w-5 h-5" /></div>
                    <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Configure Variations</h2>
                  </div>

                  <div className="space-y-8">
                    {/* Define Attributes */}
                    <div className="space-y-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                                className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-medium placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">Options</label>
                              <div className="flex flex-wrap gap-2">
                                {type.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex flex-col gap-2">
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px] font-semibold rounded-full border border-[var(--accent)]/20">
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
                                        onChange={e => updateColorMetadata(tIdx, opt, e.target.value)}
                                        className="w-full h-4 bg-transparent border-none cursor-pointer p-0"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Add option row — works on Android (button tap) + desktop (Enter) */}
                            <div className="flex gap-2">
                              <input
                                value={optionInputs[tIdx] || ''}
                                onChange={e => setOptionInputs(prev => ({ ...prev, [tIdx]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(tIdx); } }}
                                placeholder={type.name.toLowerCase() === 'color' ? 'e.g. Red' : type.name ? 'e.g. Small' : 'Option value'}
                                className="flex-1 min-w-0 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[12px] font-normal placeholder:text-[11px] focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddOption(tIdx)}
                                className="shrink-0 px-3 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-95 transition-all"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>

                    {/* SKU Matrix */}
                    {skuVariants.length > 0 && (
                      <div className="space-y-6">
                        <h3 className="text-[11px] lg:text-[12px] font-semibold tracking-[0.2em] text-[var(--accent)]">2. Variant Matrix (Prices &amp; Stock)</h3>
                        <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-xl shadow-black/5 sm:rounded-[2rem]">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--bg-secondary)] text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] border-b border-[var(--glass-border)]">
                              <tr>
                                <th className="p-5">Combination</th>
                                <th className="p-5 w-40">Price (Regular) (XAF)</th>
                                <th className="p-5 w-40">Sale Price (XAF)</th>
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
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                    />
                                  </td>
                                  <td className="p-5">
                                    <input
                                      type="number"
                                      value={sku.sale_price || ''}
                                      onChange={e => updateSKU(idx, 'sale_price', e.target.value)}
                                      placeholder="Optional"
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal placeholder:text-[11px] placeholder:font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
                                    />
                                  </td>
                                  <td className="p-5">
                                    <input
                                      type="number"
                                      value={sku.stock}
                                      onChange={e => updateSKU(idx, 'stock', e.target.value)}
                                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs sm:text-sm font-normal focus:ring-2 focus:ring-[var(--accent)]/20 outline-none"
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Product Details</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Product Name *</label>
                    <input
                      value={form.name}
                      onChange={e => updateFormField('name', e.target.value)}
                      required
                      placeholder="e.g. Aura Pro Wireless Headphones"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Description *</label>
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
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Long Description</label>
                    <textarea
                      value={form.long_description}
                      onChange={e => updateFormField('long_description', e.target.value)}
                      rows={8}
                      placeholder="Provide a detailed, in-depth description — materials, story, dimensions, use cases, care instructions..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-xs sm:text-sm font-normal text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Specifications</label>
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Media Assets</h2>
                  <span className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] ml-auto font-semibold tracking-tight">Max 5MB per image</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
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
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
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
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Inventory</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Price (XAF){!hasVariants && ' *'}</label>
                    <input
                      type="number" min="0"
                      value={form.price}
                      onChange={e => updateFormField('price', e.target.value)}
                      required={!hasVariants}
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                    {hasVariants && <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Optional for variable products — each variant has its own price.</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Sale Price (XAF)</label>
                    <input
                      type="number" min="0"
                      value={form.sale_price}
                      onChange={e => updateFormField('sale_price', e.target.value)}
                      placeholder="Optional sale price"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                    <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Optional. If provided, must be less than the regular price.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Stock Quantity{!hasVariants && ' *'}</label>
                    <input
                      type="number" min="0"
                      value={form.stock}
                      onChange={e => updateFormField('stock', e.target.value)}
                      required={!hasVariants}
                      placeholder="0"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-3 text-xs sm:text-sm font-medium text-[var(--text-primary)] placeholder:text-[11px] sm:placeholder:text-xs placeholder:font-normal placeholder:text-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    />
                    {hasVariants && <p className="mt-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Optional for variable products — stock is tracked per variant.</p>}
                  </div>
                </div>
              </section>

              {/* Shipping size */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Shipping size</h2>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mb-4 leading-relaxed">
                  Does this product fit in a box about <span className="font-bold text-[var(--text-primary)]">40 × 30 × 20 cm</span> and can one person carry it?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setParcelClass('small')}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition-all active:scale-95 ${
                      parcelClass === 'small'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span className="text-xl">📦</span>
                    <span className="text-[11px] font-bold">Yes, fits in a box</span>
                    <span className="text-[9px] opacity-60">Eligible for intercity shipping</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParcelClass('oversize')}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition-all active:scale-95 ${
                      parcelClass === 'oversize'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                        : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span className="text-xl">🛋️</span>
                    <span className="text-[11px] font-bold">No, it is too large</span>
                    <span className="text-[9px] opacity-60">Local delivery only</span>
                  </button>
                </div>
              </section>

              {/* Category & Tags */}
              <section className="p-3 sm:p-5 lg:p-8 rounded-2xl lg:rounded-[32px] glass-panel border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--glass-border)]">
                  <h2 className="font-bold tracking-tight text-[var(--text-primary)] text-sm">Organization</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)] tracking-tight mb-2 block">Category *</label>
                    <CategoryPicker
                      value={form.category}
                      onChange={name => updateFormField('category', name)}
                      appliesTo={isRestaurantVendor ? 'restaurant' : undefined}
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
    </div>
  );
}
