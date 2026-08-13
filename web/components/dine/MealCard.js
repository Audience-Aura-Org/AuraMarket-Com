"use client";

import { Star, Clock, Plus, MessageSquare } from 'lucide-react';
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

  return (
    <div className={`group relative rounded-[2rem] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1.5 backdrop-blur-xl flex flex-col h-full font-poppins ${
      unavailable ? 'opacity-50' : ''
    }`}>

      {/* ── Top bar: restaurant avatar + name + follow ── */}
      <div className="grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-2 backdrop-blur-md sm:p-2.5 md:p-3 overflow-hidden">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <div className="size-5 md:size-6 rounded-md md:rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="size-full object-cover" />
            ) : (
              <span className="text-[10px] font-black text-[var(--text-secondary)]">{initial}</span>
            )}
          </div>
          <span className="block min-w-0 truncate text-[10px] sm:text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)] leading-none">
            {storeName}
          </span>
        </div>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
          disabled={followLoading}
          className={`shrink-0 max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-semibold tracking-tight transition-all active:scale-95 shadow-sm border ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
          }`}
        >
          {isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>

      {/* ── Image ── */}
      <div className="relative overflow-hidden bg-[var(--accent)]/5" style={{ aspectRatio: '4 / 3' }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={meal.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)', backgroundSize: '24px 24px' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="select-none font-black text-white/70 leading-none"
                style={{ fontSize: 'clamp(36px, 15cqw, 64px)', letterSpacing: '-0.03em', textShadow: '0 2px 16px rgba(0,0,0,0.18)' }}
              >
                {mealInitial}
              </span>
            </div>
          </div>
        )}

        {isPopular && !unavailable && (
          <span className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <Star className="size-2.5 fill-white text-white" /> Popular
          </span>
        )}

        {unavailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="text-[11px] font-bold text-white px-3 py-1 bg-black/60 rounded-full">Unavailable</span>
          </div>
        )}
      </div>

      {/* ── Info + buttons ── */}
      <div className="p-2 sm:p-2.5 md:p-3.5 flex flex-col flex-1 gap-2 md:gap-3">

        <div className="space-y-0.5 md:space-y-1">
          <h4 className="line-clamp-2 text-[11px] sm:text-[12px] md:text-[13px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors tracking-tight">
            {meal.name}
          </h4>

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[12px] sm:text-[13px] md:text-[15px] font-bold text-[var(--accent)] truncate">
                {meal.price.toLocaleString()} XAF
              </span>
              {hasOptions && (
                <span className="text-[9px] italic text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1 py-0.5 rounded shrink-0">
                  customisable
                </span>
              )}
            </div>
            {meal.rating > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 shrink-0">
                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600">{meal.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {displayPrepTime && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <Clock className="size-3 text-orange-400 shrink-0" />
              <span>{formatPrepTime(displayPrepTime)}</span>
            </div>
          )}
        </div>

        {/* 3 action buttons */}
        <div className="grid grid-cols-3 items-center gap-1 md:gap-1.5 mt-auto">
          <button
            onClick={() => !unavailable && onSelect(meal)}
            disabled={unavailable}
            title="Add to cart"
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--accent)] text-white flex items-center justify-center gap-1 text-[9px] md:text-[10px] font-bold shadow-lg shadow-[var(--accent)]/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed px-1"
          >
            <Plus strokeWidth={3} className="size-3 md:size-3.5 shrink-0" />
          </button>
          <button
            onClick={handleMessage}
            title="Message restaurant"
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all"
          >
            <MessageSquare className="size-3.5 md:size-4 shrink-0" />
          </button>
          <button
            onClick={handleBuyNow}
            disabled={unavailable}
            className="h-8 md:h-9 rounded-lg md:rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-center text-[9px] md:text-[10px] font-bold hover:border-[var(--accent)]/40 hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed px-1"
          >
            <span className="truncate">Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
