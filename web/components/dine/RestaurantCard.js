"use client";

import Link from 'next/link';
import { Star, Clock, MapPin, Zap, BadgeCheck } from 'lucide-react';
import { useFollow } from '@/hooks/useFollow';

// ── Cuisine slug → gradient colors ────────────────────────────────────────────
const CUISINE_THEMES = {
  'cameroonian':          { from: '#ea580c', to: '#fbbf24' },
  'fast-food':            { from: '#dc2626', to: '#fb923c' },
  'chinese':              { from: '#b91c1c', to: '#f43f5e' },
  'pizza':                { from: '#c2410c', to: '#facc15' },
  'burgers':              { from: '#b45309', to: '#fb923c' },
  'shawarma':             { from: '#a16207', to: '#fcd34d' },
  'breakfast':            { from: '#ca8a04', to: '#fde68a' },
  'seafood':              { from: '#0369a1', to: '#22d3ee' },
  'vegetarian':           { from: '#166534', to: '#4ade80' },
  'desserts-and-drinks':  { from: '#be185d', to: '#e879f9' },
  'desserts-pastries':    { from: '#9d174d', to: '#a78bfa' },
  'rice-fufu':            { from: '#92400e', to: '#fcd34d' },
  'grilled-roasted':      { from: '#7f1d1d', to: '#fb923c' },
  'sandwiches-wraps':     { from: '#14532d', to: '#86efac' },
  'sides-snacks':         { from: '#713f12', to: '#fde047' },
  'cold-drinks':          { from: '#155e75', to: '#67e8f9' },
  'hot-drinks':           { from: '#78350f', to: '#fb923c' },
};

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

function getTheme(cuisine_types = [], store_name = '') {
  for (const ct of cuisine_types) {
    if (ct.slug && CUISINE_THEMES[ct.slug]) return CUISINE_THEMES[ct.slug];
  }
  return FALLBACK_THEMES[strHash(store_name) % FALLBACK_THEMES.length];
}

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

// ── Card ──────────────────────────────────────────────────────────────────────
export default function RestaurantCard({ restaurant }) {
  const {
    vendor_id,
    store_name,
    logo_url,
    banner_url,
    cuisine_types = [],
    open_status,
    is_accepting_orders,
    min_order_amount,
    prep_time_minutes,
    top_meals = [],
    rating,
    num_reviews,
    delivery_available,
    delivery_fee_estimate,
    is_verified = false,
  } = restaurant;

  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(vendor_id?.toString());

  const isOpen = open_status === 'open' && is_accepting_orders;
  const theme = getTheme(cuisine_types, store_name || '');
  const initial = (store_name || '?')[0].toUpperCase();
  const hasMealImages = top_meals.some(m => m.thumbnail_url);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 hover:border-orange-500/30">
    <Link href={`/dine/restaurant/${vendor_id}`} className="flex flex-col flex-1">
      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: '176px',
          background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
        }}
      >
        {/* Real banner image (highest priority) */}
        {banner_url && (
          <>
            <img
              src={banner_url}
              alt={store_name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </>
        )}

        {/* Fallback: stripe pattern + initial or meal strip (only when no banner) */}
        {!banner_url && (
          <>
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)',
                backgroundSize: '28px 28px',
              }}
            />
            <div
              className="absolute -bottom-10 -right-10 size-44 rounded-full opacity-20 blur-3xl"
              style={{ background: 'white' }}
            />

            {!hasMealImages && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="select-none font-black text-white/50 leading-none"
                  style={{ fontSize: '104px', letterSpacing: '-0.04em', textShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                >
                  {initial}
                </span>
              </div>
            )}

            {hasMealImages && (
              <div className="absolute inset-0 flex">
                {top_meals.filter(m => m.thumbnail_url).slice(0, 3).map((meal, i, arr) => (
                  <div key={meal._id} className="relative flex-1 overflow-hidden">
                    <img src={meal.thumbnail_url} alt={meal.name} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/20" />
                    {i < arr.length - 1 && <div className="absolute right-0 top-0 bottom-0 w-px bg-white/20" />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Open / Closed badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] lg:text-[12px] font-bold shadow-lg backdrop-blur-sm ${
          isOpen ? 'bg-emerald-500 text-white' : 'bg-black/55 text-white/85'
        }`}>
          {isOpen && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
          {isOpen ? 'Open now' : 'Closed'}
        </div>

        {/* Restaurant initial / logo avatar */}
        <div className="absolute bottom-3 left-3 size-11 lg:size-12 rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-xl">
          {logo_url ? (
            <img src={logo_url} alt={store_name} className="h-full w-full object-cover" />
          ) : (
            <span
              className="font-black text-xl lg:text-2xl text-white"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
            >
              {initial}
            </span>
          )}
        </div>

        {/* Rating pill */}
        {rating > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl bg-black/50 backdrop-blur-sm px-2 py-1 shadow">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] lg:text-[12px] font-bold text-white">{rating.toFixed(1)}</span>
            {num_reviews > 0 && (
              <span className="text-[10px] text-white/60">({num_reviews})</span>
            )}
          </div>
        )}
      </div>

      {/* ── Info ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2.5 p-3.5 lg:p-4">

        {/* Name + inline follow pill */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] lg:text-[17px] font-bold text-[var(--text-primary)] font-[Poppins] line-clamp-1 leading-snug">
                {store_name}
              </h3>
              {is_verified && (
                <BadgeCheck className="size-4 lg:size-[18px] text-blue-500 shrink-0" title="Verified restaurant" />
              )}
            </div>
            {cuisine_types.length > 0 && (
              <p className="mt-0.5 text-[11px] lg:text-[12px] text-[var(--text-secondary)] truncate">
                {cuisine_types.map(c => c.name).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
            disabled={followLoading}
            className={`shrink-0 mt-0.5 whitespace-nowrap px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-semibold tracking-tight transition-all active:scale-95 shadow-sm border ${
              isFollowing
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
            }`}
          >
            {isFollowing ? 'Following' : '+ Follow'}
          </button>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] lg:text-[12px] text-[var(--text-secondary)]">
          {prep_time_minutes && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="size-3 lg:size-3.5 text-orange-400" />
              {formatPrepTime(prep_time_minutes)} prep
            </span>
          )}
          {!!min_order_amount && (
            <span className="flex items-center gap-1 shrink-0">
              <Zap className="size-3 lg:size-3.5 text-orange-400" />
              Min {min_order_amount.toLocaleString()} XAF
            </span>
          )}
          {delivery_fee_estimate !== null && delivery_fee_estimate !== undefined && (
            <span className="flex items-center gap-1 shrink-0">
              <MapPin className="size-3 lg:size-3.5 text-orange-400" />
              {delivery_fee_estimate > 0
                ? `${delivery_fee_estimate.toLocaleString()} XAF delivery`
                : 'Free delivery'}
            </span>
          )}
          {!delivery_available && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] lg:text-[11px] text-red-500 font-semibold">
              No delivery
            </span>
          )}
        </div>

      </div>
    </Link>
    </div>
  );
}
