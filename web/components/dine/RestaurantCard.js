"use client";

import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';

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

// ── Circular restaurant card ───────────────────────────────────────────────────
export default function RestaurantCard({ restaurant }) {
  const {
    vendor_id,
    store_name,
    logo_url,
    banner_url,
    cuisine_types = [],
    open_status,
    is_accepting_orders,
    rating,
    is_verified = false,
  } = restaurant;

  const isOpen = open_status === 'open' && is_accepting_orders;
  const theme = getTheme(cuisine_types, store_name || '');
  const initial = (store_name || '?')[0].toUpperCase();

  return (
    <Link
      href={`/dine/restaurant/${vendor_id}`}
      className="group flex flex-col items-center gap-2 w-full"
    >
      {/* ── Circle image ──────────────────────────────────────────── */}
      <div className="relative size-20 md:size-24 rounded-full overflow-hidden shrink-0 shadow-md ring-2 ring-[var(--glass-border)] group-hover:ring-orange-500/60 group-hover:shadow-orange-500/20 group-hover:shadow-lg transition-all duration-200">

        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
        />

        {/* Banner image (preferred) or logo */}
        {banner_url ? (
          <img
            src={banner_url}
            alt={store_name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : logo_url ? (
          <img
            src={logo_url}
            alt={store_name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center font-black text-4xl text-white/80 select-none"
          >
            {initial}
          </span>
        )}

        {/* Closed dim overlay */}
        {!isOpen && (
          <div className="absolute inset-0 bg-black/45" />
        )}

        {/* Open indicator dot */}
        {isOpen && (
          <span className="absolute bottom-1.5 right-1.5 size-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
        )}
      </div>

      {/* ── Name + meta ───────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1">
        <div className="flex items-center gap-0.5 justify-center">
          <p className="text-[11px] md:text-[12px] font-semibold text-[var(--text-primary)] line-clamp-2 leading-tight text-center">
            {store_name}
          </p>
          {is_verified && (
            <BadgeCheck className="size-3 text-blue-500 shrink-0" />
          )}
        </div>
        {rating > 0 && (
          <p className="text-[10px] font-medium text-amber-500">★ {rating.toFixed(1)}</p>
        )}
        {!isOpen && (
          <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Closed</p>
        )}
      </div>
    </Link>
  );
}
