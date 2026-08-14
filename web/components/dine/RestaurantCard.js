"use client";

import Link from 'next/link';
import { Star, Clock, MapPin, Zap, BadgeCheck } from 'lucide-react';
import { useFollow } from '@/hooks/useFollow';

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
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

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
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-orange-400/40 transition-all duration-300">
      <Link href={`/dine/restaurant/${vendor_id}`} className="block">

        {/* ── Wide landscape banner — distinct from square product images ── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '16/7', background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
        >
          {/* Stripe texture when no banner */}
          {!banner_url && (
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)',
                backgroundSize: '18px 18px',
              }}
            />
          )}

          {/* Banner image */}
          {banner_url && (
            <img
              src={banner_url}
              alt={store_name}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          )}

          {/* Meal strip fallback when no banner but has meal images */}
          {!banner_url && hasMealImages && (
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

          {/* Gradient fade at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Open / Closed badge — top right */}
          <div className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow backdrop-blur-sm ${
            isOpen ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white/80'
          }`}>
            {isOpen && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
            {isOpen ? 'Open' : 'Closed'}
          </div>

          {/* Rating pill — top left */}
          {rating > 0 && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-1 shadow">
              <Star className="size-2.5 fill-amber-400 text-amber-400" />
              <span className="text-[10px] font-bold text-white">{rating.toFixed(1)}</span>
              {num_reviews > 0 && <span className="text-[9px] text-white/60">({num_reviews})</span>}
            </div>
          )}

          {/* Logo circle overlaid at bottom-left — anchored to banner */}
          <div className="absolute bottom-3 left-3 size-12 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-md overflow-hidden shadow-lg flex items-center justify-center">
            {logo_url ? (
              <img src={logo_url} alt={store_name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-black text-2xl text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                {initial}
              </span>
            )}
          </div>

          {/* Restaurant name on banner */}
          <div className="absolute bottom-3 left-[4.5rem] right-3">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-bold text-white leading-tight line-clamp-1" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                {store_name}
              </h3>
              {is_verified && <BadgeCheck className="size-3.5 text-blue-300 shrink-0" />}
            </div>
            {cuisine_types.length > 0 && (
              <p className="text-[10px] text-white/70 mt-0.5 line-clamp-1">
                {cuisine_types.map(c => c.name).join(' · ')}
              </p>
            )}
          </div>
        </div>

      </Link>

      {/* ── Info strip below banner ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-secondary)] min-w-0">
          {prep_time_minutes && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="size-3 text-orange-400" />
              {formatPrepTime(prep_time_minutes)}
            </span>
          )}
          {!!min_order_amount && (
            <span className="flex items-center gap-1 shrink-0">
              <Zap className="size-3 text-orange-400" />
              Min {min_order_amount.toLocaleString()} XAF
            </span>
          )}
          {delivery_fee_estimate !== null && delivery_fee_estimate !== undefined && (
            <span className="flex items-center gap-1 shrink-0">
              <MapPin className="size-3 text-orange-400" />
              {delivery_fee_estimate > 0 ? `${delivery_fee_estimate.toLocaleString()} XAF` : 'Free delivery'}
            </span>
          )}
        </div>

        {/* Follow button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(); }}
          disabled={followLoading}
          className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-semibold transition-all active:scale-95 border ${
            isFollowing
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110'
          }`}
        >
          {isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>
    </div>
  );
}
