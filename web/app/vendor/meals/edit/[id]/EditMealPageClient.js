"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, X, Plus, Utensils, Check,
  Flame, ShoppingBag, Clock, Package, CalendarClock,
} from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import api from '@/services/api';
import CategoryPicker from '@/components/CategoryPicker';
import { toast } from 'react-hot-toast';
import {
  MAX_PRODUCT_IMAGES,
  prepareProductImageEntries,
} from '@/lib/productImageUpload';

const SPICE_OPTIONS = [
  { value: 'none',   label: 'None',   color: 'text-slate-500',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30'  },
  { value: 'mild',   label: 'Mild',   color: 'text-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  { value: 'medium', label: 'Medium', color: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { value: 'hot',    label: 'Hot',    color: 'text-red-600',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
];

const DIETARY_TAGS = [
  { value: 'vegan',       label: 'Vegan',       icon: '🌱' },
  { value: 'vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { value: 'gluten_free', label: 'Gluten-free', icon: '🌾' },
  { value: 'halal',       label: 'Halal',       icon: '☪'  },
];

const BOOKING_MODES = [
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

function emptyOptionGroup() {
  return { name: '', is_required: false, min_select: 1, max_select: 1, options: [] };
}

function emptyOption() {
  return { label: '', price_delta: 0, is_default: false, is_available: true };
}

function EditMealPageInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  // Support both ?id=xxx (static APK route) and /edit/[id] (dynamic web route)
  const id = searchParams?.get('id') || params?.id;

  const fileInputRef = useRef(null);
  const savingRef = useRef(false);

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);

  // images: { url, existing: true } for loaded images, { file, url: preview, existing: false } for new
  const [images, setImages] = useState([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category: '',
  });

  const [mealAttrs, setMealAttrs] = useState({
    spice_level: 'none',
    dietary_tags: [],
    is_available_today: true,
    prep_time_value: '',
    available_date: '',
  });
  const [prepTimeUnit, setPrepTimeUnit] = useState('minutes');

  const [bookingOptions, setBookingOptions] = useState(['delivery']);
  const [optionGroups, setOptionGroups] = useState([]);

  // ---------- load meal ----------
  useEffect(() => {
    if (!id) return;
    api.get(`/products/${id}`, { skipClientCache: true })
      .then(res => {
        if (!res.data.success) return;
        const p = res.data.data.product;

        setForm({
          name:        p.name        || '',
          description: p.description || '',
          price:       p.price       ?? '',
          stock:       p.stock       ?? '',
          category:    p.category    || '',
        });

        if (Array.isArray(p.images)) {
          setImages(p.images.map(img =>
            typeof img === 'string'
              ? { url: img, existing: true }
              : { url: img.url || img.location || '', existing: true }
          ));
        }

        if (p.meal) {
          const opts = (p.meal.booking_options || [])
            .map(o => (typeof o === 'string' ? o : o.type))
            .filter(Boolean);
          if (opts.length) setBookingOptions(opts);

          const prepAttrs = {};
          if (p.meal.prep_time_minutes) {
            const { value, unit } = minutesToDisplay(p.meal.prep_time_minutes);
            prepAttrs.prep_time_value = value;
            setPrepTimeUnit(unit);
          }

          setMealAttrs({
            spice_level:        p.meal.spice_level        || 'none',
            dietary_tags:       p.meal.dietary_tags        || [],
            is_available_today: p.meal.is_available_today  ?? true,
            prep_time_value:    prepAttrs.prep_time_value  || '',
            available_date:     p.meal.available_date
              ? new Date(p.meal.available_date).toISOString().split('T')[0]
              : '',
          });

          if (Array.isArray(p.meal.option_groups)) {
            setOptionGroups(p.meal.option_groups);
          }
        }
      })
      .catch(err => {
        toast.error('Could not load meal data.');
        console.error('EditMeal load error', err);
      })
      .finally(() => setFetching(false));
  }, [id]);

  // ---------- images ----------
  const handleImageFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(f => f.type?.startsWith('image/'));
    if (!incoming.length) { toast.error('Select image files.'); return; }
    const room = MAX_PRODUCT_IMAGES - images.length;
    if (room <= 0) { toast.error(`Max ${MAX_PRODUCT_IMAGES} images.`); return; }
    const selected = incoming.slice(0, room);
    try {
      const prepared = await prepareProductImageEntries(selected);
      // prepareProductImageEntries returns { file, url: dataURL }
      setImages(prev => [...prev, ...prepared.map(e => ({ ...e, existing: false }))]);
    } catch (err) {
      toast.error(err.message || 'Could not prepare images.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------- dietary tags ----------
  const toggleDietaryTag = (tag) => {
    setMealAttrs(prev => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter(t => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  // ---------- booking modes ----------
  const toggleBookingMode = (mode) => {
    setBookingOptions(prev => {
      const next = prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode];
      return next;
    });
  };

  // ---------- option groups ----------
  const addOptionGroup = () => setOptionGroups(prev => [...prev, emptyOptionGroup()]);

  const removeOptionGroup = (gIdx) =>
    setOptionGroups(prev => prev.filter((_, i) => i !== gIdx));

  const updateGroup = (gIdx, field, value) =>
    setOptionGroups(prev => prev.map((g, i) => i === gIdx ? { ...g, [field]: value } : g));

  const addOptionToGroup = (gIdx) =>
    setOptionGroups(prev => prev.map((g, i) =>
      i === gIdx ? { ...g, options: [...g.options, emptyOption()] } : g
    ));

  const updateOption = (gIdx, oIdx, field, value) =>
    setOptionGroups(prev => prev.map((g, i) => {
      if (i !== gIdx) return g;
      return { ...g, options: g.options.map((o, j) => j === oIdx ? { ...o, [field]: value } : o) };
    }));

  const removeOption = (gIdx, oIdx) =>
    setOptionGroups(prev => prev.map((g, i) =>
      i === gIdx ? { ...g, options: g.options.filter((_, j) => j !== oIdx) } : g
    ));

  // ---------- submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current || loading) return;

    if (!form.name.trim()) return toast.error('Meal name is required.');
    if (!form.price || Number(form.price) <= 0) return toast.error('Please enter a valid price.');
    if (!form.stock || Number(form.stock) <= 0) return toast.error('Please enter a stock quantity.');
    if (!form.category) return toast.error('Please select a category.');
    if (!images.length) return toast.error('At least one image is required.');
    if (!bookingOptions.length) return toast.error('Select at least one booking mode.');

    for (const g of optionGroups) {
      if (!g.name.trim()) return toast.error('Option group name is required.');
      if (!g.options.length) return toast.error(`Add at least one option to "${g.name}".`);
      for (const o of g.options) {
        if (!o.label.trim()) return toast.error(`Option label missing in "${g.name}".`);
      }
    }

    savingRef.current = true;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('price', form.price);
      fd.append('stock', form.stock);
      fd.append('category', form.category);
      fd.append('is_meal', 'true');
      fd.append('meal', JSON.stringify({
        spice_level:        mealAttrs.spice_level,
        dietary_tags:       mealAttrs.dietary_tags,
        is_available_today: mealAttrs.is_available_today,
        available_date:     mealAttrs.available_date || null,
        prep_time_minutes:  mealAttrs.prep_time_value
          ? Number(mealAttrs.prep_time_value) * (PREP_UNITS.find(u => u.value === prepTimeUnit)?.factor ?? 1)
          : null,
        option_groups:      optionGroups,
        booking_options:    bookingOptions.map(v => ({ type: v })),
      }));

      // Existing images: pass URLs so backend keeps them
      images.filter(i => i.existing).forEach(i => fd.append('existing_images', i.url));
      // New uploads: pass the actual File objects
      images.filter(i => !i.existing).forEach(i => fd.append('images', i.file));

      const res = await api.patch(`/products/${id}`, fd);
      if (res.data.success) {
        toast.success(`"${form.name}" updated!`);
        router.push('/vendor/meals');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save changes. Please try again.', { duration: 6000 });
    } finally {
      savingRef.current = false;
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center py-24">
        <div className="size-9 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 md:top-16 lg:top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-[var(--accent)]/5 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight font-[Poppins]">Edit Meal</h1>
            <p className="text-[10px] text-[var(--text-secondary)] hidden sm:block">Update your menu item</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 sm:px-6 py-2 rounded-xl bg-orange-500 text-white text-[11px] sm:text-[12px] font-bold shadow-md shadow-orange-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-[900px] px-4 py-5 sm:px-6 pb-32 space-y-5">

        {/* Images */}
        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 sm:p-6">
          <h2 className="text-[13px] font-semibold font-[Poppins] text-[var(--text-secondary)] mb-4 flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full bg-orange-500" />
            Photos
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--glass-border)]">
                <img src={img.url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 size-5 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  <X className="size-3" />
                </button>
                {img.existing && (
                  <div className="absolute bottom-1 left-1 rounded-full bg-emerald-500 size-2" title="Existing image" />
                )}
              </div>
            ))}
            {images.length < MAX_PRODUCT_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center gap-1 text-[var(--text-secondary)] hover:border-orange-500/50 hover:text-orange-500 transition-all"
              >
                <Upload className="size-5" />
                <span className="text-[10px] font-medium">Add</span>
              </button>
            )}
          </div>
        </section>

        {/* Basics */}
        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 sm:p-6 space-y-4">
          <h2 className="text-[13px] font-semibold font-[Poppins] text-[var(--text-secondary)] flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full bg-orange-500" />
            Basics
          </h2>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Meal Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Grilled Chicken Wings"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the dish, key ingredients..."
              className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Base Price (XAF) *</label>
            <input
              required
              type="number"
              min="0"
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              placeholder="2500"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Stock Quantity *</label>
            <input
              required
              type="number"
              min="1"
              value={form.stock}
              onChange={e => setForm(p => ({ ...p, stock: e.target.value }))}
              placeholder="e.g. 50"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
            />
            <p className="text-[10px] text-[var(--text-secondary)] opacity-60">How many portions can be ordered today</p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Prep Time <span className="font-normal opacity-60">— how long to prepare this meal</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={mealAttrs.prep_time_value}
                onChange={e => setMealAttrs(p => ({ ...p, prep_time_value: e.target.value }))}
                placeholder="e.g. 15"
                className="w-24 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
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
          </div>

          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-1.5">
            <label className="text-[11px] font-semibold font-[Poppins] text-orange-600">Category *</label>
            <CategoryPicker
              appliesTo="restaurant"
              value={form.category}
              onChange={cat => setForm(p => ({ ...p, category: cat }))}
            />
          </div>
        </section>

        {/* Meal Attributes */}
        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 sm:p-6 space-y-5">
          <h2 className="text-[13px] font-semibold font-[Poppins] text-[var(--text-secondary)] flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full bg-orange-500" />
            Meal Attributes
          </h2>

          {/* Availability today */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">Available today</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Customers can order this meal right now</p>
            </div>
            <button
              type="button"
              onClick={() => setMealAttrs(p => ({ ...p, is_available_today: !p.is_available_today }))}
              className={`relative inline-flex size-11 items-center rounded-full border transition-colors ${
                mealAttrs.is_available_today
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-[var(--bg-primary)] border-[var(--glass-border)]'
              }`}
            >
              <span className={`absolute left-1 size-[calc(100%-8px)] rounded-full bg-white transition-transform ${
                mealAttrs.is_available_today ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Available date — optional; lets vendors schedule when this meal becomes available */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Available date <span className="font-normal text-[var(--text-secondary)]">(optional)</span></p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">The date this meal will be ready for pickup or delivery</p>
              </div>
              {mealAttrs.available_date && (
                <button
                  type="button"
                  onClick={() => setMealAttrs(p => ({ ...p, available_date: '' }))}
                  className="text-[10px] font-semibold text-rose-500 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={mealAttrs.available_date}
              onChange={e => setMealAttrs(p => ({ ...p, available_date: e.target.value }))}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
            />
            {mealAttrs.available_date && (
              <p className="text-[10px] text-amber-600">
                Scheduled for {new Date(mealAttrs.available_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Spice level */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Spice Level</label>
            <div className="grid grid-cols-4 gap-2">
              {SPICE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMealAttrs(p => ({ ...p, spice_level: opt.value }))}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-3 px-2 text-[10px] font-bold transition-all ${
                    mealAttrs.spice_level === opt.value
                      ? `${opt.border} ${opt.bg} ${opt.color}`
                      : 'border-[var(--glass-border)] text-[var(--text-secondary)] bg-[var(--bg-secondary)]'
                  }`}
                >
                  <Flame className={`size-4 ${mealAttrs.spice_level === opt.value ? opt.color : 'opacity-40'}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary tags */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Dietary Tags</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_TAGS.map(tag => {
                const selected = mealAttrs.dietary_tags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => toggleDietaryTag(tag.value)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      selected
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <span>{tag.icon}</span>
                    {tag.label}
                    {selected && <Check className="size-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Booking Modes */}
        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 sm:p-6 space-y-3">
          <h2 className="text-[13px] font-semibold font-[Poppins] text-[var(--text-secondary)] flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full bg-orange-500" />
            Order Modes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BOOKING_MODES.map(mode => {
              const Icon = mode.icon;
              const selected = bookingOptions.includes(mode.value);
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleBookingMode(mode.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-3 text-[11px] font-bold transition-all ${
                    selected
                      ? 'border-orange-500/50 bg-orange-500/10 text-orange-600'
                      : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className={`size-5 ${selected ? 'text-orange-500' : 'opacity-40'}`} />
                  {mode.label}
                  {selected && (
                    <span className="size-4 rounded-full bg-orange-500 flex items-center justify-center">
                      <Check className="size-2.5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Option Groups */}
        <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold font-[Poppins] text-[var(--text-secondary)] flex items-center gap-2">
              <span className="h-4 w-0.5 rounded-full bg-orange-500" />
              Option Groups
            </h2>
            <button
              type="button"
              onClick={addOptionGroup}
              className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/8 px-3 py-2 text-[11px] font-bold text-orange-600 hover:bg-orange-500/15 transition-all"
            >
              <Plus className="size-3.5" />
              Add Group
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)]">
            Let customers customise their meal — e.g. Sauce choice, add-ons, size.
          </p>

          <AnimatePresence>
            {optionGroups.map((group, gIdx) => (
              <motion.div
                key={gIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 p-4 space-y-4"
              >
                {/* Group header */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <input
                      value={group.name}
                      onChange={e => updateGroup(gIdx, 'name', e.target.value)}
                      placeholder="Group name (e.g. Sauce choice)"
                      className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[12px] font-semibold outline-none focus:border-orange-500/50 transition-colors"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={group.is_required}
                          onChange={e => updateGroup(gIdx, 'is_required', e.target.checked)}
                          className="rounded accent-orange-500"
                        />
                        <span className="font-semibold text-[var(--text-secondary)]">Required</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-secondary)] font-medium">Min:</span>
                        <input
                          type="number"
                          min="0"
                          value={group.min_select}
                          onChange={e => updateGroup(gIdx, 'min_select', Number(e.target.value))}
                          className="w-12 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-center outline-none focus:border-orange-500/50"
                        />
                        <span className="text-[var(--text-secondary)] font-medium">Max:</span>
                        <input
                          type="number"
                          min="1"
                          value={group.max_select}
                          onChange={e => updateGroup(gIdx, 'max_select', Number(e.target.value))}
                          className="w-12 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-center outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOptionGroup(gIdx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  {group.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        value={opt.label}
                        onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)}
                        placeholder="Option label"
                        className="flex-1 min-w-0 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[11px] outline-none focus:border-orange-500/50 transition-colors"
                      />
                      <input
                        type="number"
                        min="0"
                        value={opt.price_delta || ''}
                        onChange={e => updateOption(gIdx, oIdx, 'price_delta', Number(e.target.value) || 0)}
                        placeholder="+XAF"
                        className="w-20 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2 py-2 text-[11px] text-center outline-none focus:border-orange-500/50 transition-colors"
                      />
                      <button
                        type="button"
                        title="Set as default"
                        onClick={() => updateOption(gIdx, oIdx, 'is_default', !opt.is_default)}
                        className={`size-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                          opt.is_default
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-orange-500/30'
                        }`}
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOption(gIdx, oIdx)}
                        className="size-7 rounded-lg flex items-center justify-center shrink-0 text-rose-500 hover:bg-rose-500/10 border border-transparent transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addOptionToGroup(gIdx)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--glass-border)] py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-orange-500/40 hover:text-orange-500 transition-all"
                  >
                    <Plus className="size-3.5" />
                    Add Option
                  </button>

                  {group.options.length > 0 && (
                    <p className="text-[10px] text-[var(--text-secondary)] text-center opacity-60">
                      Tick ✓ to mark default options · +XAF adds to base price
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {optionGroups.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--glass-border)] py-8 text-center">
              <p className="text-[11px] text-[var(--text-secondary)] opacity-60">No option groups yet. Add one to let customers customise their order.</p>
            </div>
          )}
        </section>

        {/* Bottom save */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-[var(--glass-border)] py-3.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] rounded-xl bg-orange-500 py-3.5 text-[12px] font-bold text-white shadow-md shadow-orange-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditMealPageClient() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="size-9 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    }>
      <EditMealPageInner />
    </Suspense>
  );
}
