"use client";

import { useState, useEffect } from 'react';
import { X, Star, Clock, Plus, Minus, ChevronRight, Zap, ShoppingBag, Check, Package, Utensils, CalendarClock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { cartStore } from '@/services/cartStore';

function formatPrepTime(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h} hr`;
  }
  if (mins < 10080) {
    const d = Math.floor(mins / 1440);
    return `${d} day${d !== 1 ? 's' : ''}`;
  }
  const w = Math.floor(mins / 10080);
  return `${w} week${w !== 1 ? 's' : ''}`;
}

const FALLBACK_THEMES = [
  { from: '#ea580c', to: '#fbbf24' },
  { from: '#be185d', to: '#fb7185' },
  { from: '#7c3aed', to: '#c084fc' },
  { from: '#0f766e', to: '#2dd4bf' },
  { from: '#166534', to: '#86efac' },
  { from: '#1e40af', to: '#818cf8' },
];

function strHash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

const BOOKING_MODES = [
  { value: 'delivery',  label: 'Delivery',  Icon: ShoppingBag  },
  { value: 'pickup',    label: 'Pickup',    Icon: Package      },
  { value: 'dine_in',   label: 'Dine-In',   Icon: Utensils     },
  { value: 'pre_order', label: 'Pre-Order', Icon: CalendarClock },
];

function computeDefaults(optionGroups = []) {
  const sel = {};
  for (const group of optionGroups) {
    sel[group.name] = (group.options || [])
      .filter(o => o.is_default && o.is_available)
      .map(o => o.label);
  }
  return sel;
}

export default function MealDetailModal({ meal, onClose }) {
  const { user }  = useAuthStore();
  const router    = useRouter();

  const [fullProduct,    setFullProduct]    = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [selections,     setSelections]     = useState({});
  const [quantity,       setQuantity]       = useState(1);
  const [adding,         setAdding]         = useState(false);
  const [bookingType,    setBookingType]    = useState(null);   // selected order mode
  const [availableModes, setAvailableModes] = useState([]);     // from meal.booking_options

  const theme       = FALLBACK_THEMES[strHash(meal.name || '') % FALLBACK_THEMES.length];
  const initial     = (meal.restaurant_name || '?')[0].toUpperCase();
  const mealInitial = (meal.name || '?')[0].toUpperCase();

  /* ── Fetch full product on open ── */
  useEffect(() => {
    if (!meal?._id) { setLoadingProduct(false); return; }
    setLoadingProduct(true);
    api.get(`/products/${meal._id}`)
      .then(res => {
        const p = res.data?.data?.product || res.data?.data || null;
        setFullProduct(p);
        const groups = p?.meal?.option_groups;
        if (groups?.length) setSelections(computeDefaults(groups));
        // Derive available booking modes from the product's booking_options array
        const modes = (p?.meal?.booking_options || [])
          .map(o => (typeof o === 'string' ? o : o.type))
          .filter(Boolean);
        setAvailableModes(modes);
        // Auto-select when only one mode is available
        if (modes.length === 1) setBookingType(modes[0]);
        else if (modes.includes('delivery')) setBookingType('delivery'); // sensible default
      })
      .catch(() => setFullProduct(null))
      .finally(() => setLoadingProduct(false));
  }, [meal._id]);

  const optionGroups = fullProduct?.meal?.option_groups || [];
  const description  = fullProduct?.description || meal.description || '';
  const prepTime     = fullProduct?.meal?.prep_time_minutes || meal.prep_time_minutes;

  /* ── Option toggle ── */
  const toggleOption = (groupName, optionLabel, maxSelect) => {
    setSelections(prev => {
      const current = prev[groupName] || [];
      if (current.includes(optionLabel)) {
        return { ...prev, [groupName]: current.filter(l => l !== optionLabel) };
      }
      if (current.length >= maxSelect) {
        if (maxSelect === 1) return { ...prev, [groupName]: [optionLabel] };
        return prev;
      }
      return { ...prev, [groupName]: [...current, optionLabel] };
    });
  };

  /* ── Price calculation ── */
  const totalDelta = optionGroups.reduce((acc, group) => {
    const chosen = selections[group.name] || [];
    return acc + (group.options || [])
      .filter(o => chosen.includes(o.label))
      .reduce((s, o) => s + (o.price_delta || 0), 0);
  }, 0);

  const totalPrice = (meal.price + totalDelta) * quantity;

  /* ── Validation ── */
  const invalidGroups = optionGroups.filter(
    g => g.is_required && (selections[g.name] || []).length < (g.min_select || 1)
  );
  const canOrder = invalidGroups.length === 0 && !!bookingType;

  /* ── Build cart payload ── */
  const buildPayload = () => ({
    product_id:       meal._id,
    quantity,
    booking_type:     bookingType || 'delivery',
    selected_options: optionGroups.flatMap(group =>
      (group.options || [])
        .filter(o => (selections[group.name] || []).includes(o.label))
        .map(o => ({
          group_name:   group.name,
          option_label: o.label,
          price_delta:  o.price_delta || 0,
        }))
    ),
  });

  /* ── Add to cart ── */
  const handleAddToCart = async () => {
    if (!user) { router.push('/login'); return; }
    if (!canOrder) return;
    setAdding(true);
    try {
      const res = await api.post('/cart', buildPayload());
      if (res.data.success) {
        cartStore.setCart(res.data.data?.cart);
        toast.success('Added to cart!');
        onClose();
      }
    } catch (err) {
      const code = err.response?.data?.code;
      toast.error(
        code === 'DIFFERENT_RESTAURANT'
          ? 'Dine-in orders are limited to one restaurant. Clear your cart first.'
          : (err.response?.data?.message || 'Could not add to cart.')
      );
    } finally {
      setAdding(false);
    }
  };

  /* ── Buy Now ── */
  const handleBuyNow = async () => {
    if (!user) { router.push('/login'); return; }
    if (!canOrder) return;

    /* No options → direct checkout URL */
    if (optionGroups.length === 0) {
      onClose();
      router.push(`/checkout?productId=${meal._id}&quantity=${quantity}&bookingType=${bookingType || 'delivery'}`);
      return;
    }

    /* Has options → add to cart first, then go to checkout */
    setAdding(true);
    try {
      const res = await api.post('/cart', buildPayload());
      if (res.data.success) {
        cartStore.setCart(res.data.data?.cart);
        onClose();
        router.push('/checkout');
      }
    } catch (err) {
      const code = err.response?.data?.code;
      toast.error(
        code === 'DIFFERENT_RESTAURANT'
          ? 'Dine-in orders are limited to one restaurant. Clear your cart first.'
          : (err.response?.data?.message || 'Could not add to cart.')
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet on mobile → centered modal on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-[700] pointer-events-none sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="pointer-events-auto w-full sm:max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-[24px] sm:rounded-2xl bg-[var(--bg-primary)] border-t border-[var(--glass-border)] sm:border shadow-2xl flex flex-col sm:flex-row pb-[env(safe-area-inset-bottom,16px)] sm:pb-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--glass-border)]" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <X className="size-4" />
        </button>

        {/* Hero image — strip on mobile, sidebar on desktop */}
        <div className="relative w-full h-52 shrink-0 overflow-hidden sm:w-[42%] sm:h-auto sm:self-stretch sm:rounded-l-2xl">
          {meal.thumbnail_url ? (
            <img
              src={meal.thumbnail_url}
              alt={meal.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
            >
              <div
                className="absolute inset-0 opacity-[0.08]"
                style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)', backgroundSize: '28px 28px' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="select-none font-black text-white/50 leading-none"
                  style={{ fontSize: '72px', letterSpacing: '-0.04em' }}
                >
                  {mealInitial}
                </span>
              </div>
            </div>
          )}
          {/* Gradient overlay so close button is always readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Right panel — scrollable content + footer */}
        <div className="flex flex-col flex-1 min-h-0 sm:overflow-hidden">

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-4 space-y-3">

            {/* Restaurant row */}
            <Link
              href={`/dine/restaurant/${meal.vendor_id}`}
              onClick={onClose}
              className="flex items-center gap-2 group/vendor"
            >
              <div className="size-6 shrink-0 rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                {meal.restaurant_logo_url ? (
                  <img src={meal.restaurant_logo_url} alt={meal.restaurant_name} className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black text-[var(--text-secondary)]">{initial}</span>
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors">
                {meal.restaurant_name}
              </span>
              <ChevronRight className="size-3 shrink-0 text-[var(--text-secondary)]" />
            </Link>

            {/* Meal name + price + rating in one compact block */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-bold text-[var(--text-primary)] font-[Poppins] leading-snug flex-1">
                {meal.name}
              </h2>
              <div className="shrink-0 text-right">
                <div className="text-[18px] font-bold text-[var(--accent)] leading-tight">
                  {meal.price.toLocaleString()}
                  <span className="text-[11px] font-semibold ml-0.5">XAF</span>
                  {totalDelta > 0 && (
                    <span className="block text-[10px] text-[var(--text-secondary)] font-medium">base</span>
                  )}
                </div>
                {meal.rating > 0 && (
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Star className="size-3 fill-[var(--accent)] text-[var(--accent)]" />
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      {meal.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Prep time */}
            {prepTime && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <Clock className="size-3 text-[var(--accent)] shrink-0" />
                Ready in {formatPrepTime(prepTime)}
              </div>
            )}

            {/* Description */}
            {description && (
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--glass-border)] pt-3">
                {description}
              </p>
            )}

            {/* Single mode badge — when only one mode, show it as informational */}
            {!loadingProduct && availableModes.length === 1 && bookingType && (() => {
              const m = BOOKING_MODES.find(b => b.value === bookingType);
              if (!m) return null;
              const { Icon } = m;
              return (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] border-t border-[var(--glass-border)] pt-3">
                  <Icon className="size-3.5 text-[var(--accent)] shrink-0" />
                  {m.label}
                </div>
              );
            })()}

            {/* Order mode picker — only shown when multiple modes are available */}
            {!loadingProduct && availableModes.length > 1 && (
              <div className="border-t border-[var(--glass-border)] pt-3 space-y-2">
                <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wide">
                  Order Mode <span className="text-orange-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BOOKING_MODES.filter(m => availableModes.includes(m.value)).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBookingType(value)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-all active:scale-95 ${
                        bookingType === value
                          ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Icon className={`size-3.5 shrink-0 ${bookingType === value ? 'text-[var(--accent)]' : 'opacity-50'}`} />
                      {label}
                      {bookingType === value && <Check className="size-3 ml-auto text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Option groups */}
            {loadingProduct ? (
              <div className="space-y-2 animate-pulse border-t border-[var(--glass-border)] pt-3">
                <div className="h-3 w-28 bg-[var(--bg-secondary)] rounded" />
                <div className="h-11 bg-[var(--bg-secondary)] rounded-xl" />
                <div className="h-11 bg-[var(--bg-secondary)] rounded-xl" />
              </div>
            ) : optionGroups.length > 0 && (
              <div className="space-y-4 border-t border-[var(--glass-border)]">
                {optionGroups.map(group => (
                  <div key={group.name} className="pt-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-[12px] font-bold text-[var(--text-primary)] font-[Poppins]">
                        {group.name}
                      </h3>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                        group.is_required
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}>
                        {group.is_required ? 'Required' : 'Optional'}
                        {' · '}
                        {group.min_select === group.max_select
                          ? `Pick ${group.max_select}`
                          : `Up to ${group.max_select}`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(group.options || []).map(option => {
                        const isSelected = (selections[group.name] || []).includes(option.label);
                        const unavail    = !option.is_available;
                        return (
                          <button
                            key={option.label}
                            onClick={() => !unavail && toggleOption(group.name, option.label, group.max_select)}
                            disabled={unavail}
                            className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all text-left ${
                              isSelected
                                ? 'border-[var(--accent)]/50 bg-[var(--accent)]/8'
                                : unavail
                                ? 'border-[var(--glass-border)] opacity-40 cursor-not-allowed'
                                : 'border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                                  : 'border-[var(--glass-border)]'
                              }`}>
                                {isSelected && <Check className="size-3 text-white stroke-[3]" />}
                              </div>
                              <span className="text-[12px] font-medium text-[var(--text-primary)]">
                                {option.label}
                              </span>
                            </div>
                            {option.price_delta > 0 && (
                              <span className="text-[11px] font-semibold text-[var(--accent)] shrink-0 ml-2">
                                +{option.price_delta.toLocaleString()} XAF
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {group.is_required && (selections[group.name] || []).length < (group.min_select || 1) && (
                      <p className="mt-1.5 text-[10px] text-orange-500 font-medium">
                        Please select at least {group.min_select || 1} option
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: quantity + action buttons */}
        <div className="shrink-0 border-t border-[var(--glass-border)] px-4 py-3 space-y-3">

          {/* Quantity stepper */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="size-8 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="text-[14px] font-bold text-[var(--text-primary)] w-5 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="size-8 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Add to cart + Buy Now */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleAddToCart}
              disabled={adding || !canOrder}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[12px] font-bold text-[var(--text-primary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-50"
            >
              <ShoppingBag className="size-4 shrink-0" />
              {adding ? 'Adding\u2026' : 'Add to cart'}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={adding || !canOrder}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold shadow-lg shadow-[var(--accent)]/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap className="size-4 shrink-0 fill-white" />
              {totalDelta > 0 || quantity > 1
                ? `${totalPrice.toLocaleString()} XAF`
                : 'Buy Now'}
            </button>
          </div>
        </div>

        </div>{/* end right panel */}
      </motion.div>
      </div>
    </>
  );
}
