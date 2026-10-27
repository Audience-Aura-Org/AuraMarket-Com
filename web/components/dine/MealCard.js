"use client";

import { Star, Clock, Plus, MessageSquare, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import { useAuthStore } from '@/hooks/useAuth';
import { useFollow } from '@/hooks/useFollow';

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

function formatPrepTime(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h} hr`;
  }
  const d = Math.floor(mins / 1440);
  return `${d} day${d !== 1 ? 's' : ''}`;
}

export default function MealCard({
  meal,
  onSelect,
  unavailable = false,
  vendorId = null,
  storeName = '',
  logoUrl = null,
  prepTime = null,
}) {
  const thumbnail   = meal.images?.[0]?.url || null;
  const theme       = FALLBACK_THEMES[strHash(meal.name || '') % FALLBACK_THEMES.length];
  const mealInitial = (meal.name || '?')[0].toUpperCase();
  const hasOptions  = (meal.meal?.option_groups || []).length > 0;
  const isPopular   = meal.rating >= 4.5;
  const initial     = (storeName || '?')[0].toUpperCase();
  // Only show prep time when the individual meal has its own value set
  const displayPrepTime = meal.meal?.prep_time_minutes || null;

  const router       = useRouter();
  const { openChat } = useChat();
  const { user }     = useAuthStore();
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(vendorId);

  const handleMessage = () => {
    openChat(vendorId || null, {
      _id:    meal._id,
      name:   meal.name,
      price:  meal.price,
      images: meal.images || [],
    }, null, false);
  };

  const handleBuyNow = () => {
    if (!user) { router.push('/login'); return; }
    if (unavailable) return;
    if (hasOptions) { onSelect(meal); return; }
    router.push(`/checkout?productId=${meal._id}&quantity=1`);
  };

  const select = () => !unavailable && onSelect && onSelect(meal);
  const secondaryButton = 'h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className={`group relative min-w-0 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm hover:border-[var(--accent)]/30 hover:shadow-md transition-[color,background-color,border-color,box-shadow] duration-150 overflow-hidden flex flex-col h-full font-poppins ${
      unavailable ? 'opacity-60' : ''
    }`}>

      {/* ── Top bar: restaurant avatar + name + follow ── */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 px-3 py-2.5 sm:px-4 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <div className="size-5 md:size-6 rounded-md md:rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{initial}</span>
            )}
          </div>
          <span className="block min-w-0 truncate text-[10px] font-semibold text-[var(--text-primary)] leading-none" title={storeName}>
            {storeName}
          </span>
        </div>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
          disabled={followLoading}
          className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] duration-150 shadow-sm border ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
          }`}
        >
          {isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>

      {/* ── Image ── */}
      <div
        className={`relative aspect-[4/3] overflow-hidden bg-[var(--accent)]/5${onSelect && !unavailable ? ' cursor-pointer' : ''}`}
        onClick={select}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={meal.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-product.svg'; }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
            <span className="select-none text-[40px] font-bold leading-none text-white/70">{mealInitial}</span>
          </div>
        )}

        {isPopular && !unavailable && (
          <span className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
            <Star className="size-2.5 fill-white text-white" /> Popular
          </span>
        )}

        {unavailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="px-4 py-2 bg-black/70 text-white text-[10px] font-semibold rounded-full">Unavailable</span>
          </div>
        )}
      </div>

      {/* ── Info + buttons ── */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2 md:gap-3">

        <div className="space-y-0.5 md:space-y-1">
          <h4
            className={`line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight${onSelect && !unavailable ? ' cursor-pointer' : ''}`}
            onClick={select}
          >
            {meal.name}
          </h4>

          <div className="flex items-baseline justify-between gap-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
              <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] [overflow-wrap:anywhere]">
                {meal.price.toLocaleString()}{' '}
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span>
              </span>
              {hasOptions && (
                <span className="shrink-0 rounded-full border border-[var(--glass-border)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-secondary)]">
                  Customisable
                </span>
              )}
            </div>
            {meal.rating > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[10px]">{meal.rating.toFixed(1)}</span>
              </span>
            )}
          </div>

          {displayPrepTime && (
            <span className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)] opacity-70">
              <Clock className="size-2.5 shrink-0" />
              <span className="text-[9px]">Ready in {formatPrepTime(displayPrepTime)}</span>
            </span>
          )}
        </div>

        {/* 3 action buttons */}
        <div className="grid grid-cols-3 items-center gap-1 md:gap-1.5 mt-auto">
          <button
            onClick={select}
            disabled={unavailable}
            title="Add to cart"
            aria-label="Add to cart"
            className="h-9 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-sm shadow-[var(--accent)]/25 hover:brightness-110 transition-[color,background-color,border-color,box-shadow] duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus strokeWidth={3} className="size-3.5 shrink-0" />
          </button>
          <button
            onClick={handleMessage}
            title="Message restaurant"
            aria-label="Message restaurant"
            className={`${secondaryButton} text-[var(--text-secondary)]`}
          >
            <MessageSquare className="size-3.5 shrink-0" />
          </button>
          <button
            onClick={handleBuyNow}
            disabled={unavailable}
            title="Buy now"
            aria-label="Buy now"
            className={`${secondaryButton} text-[var(--text-primary)]`}
          >
            <ShoppingCart className="size-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
