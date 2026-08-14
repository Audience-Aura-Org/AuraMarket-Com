"use client";
export function generateStaticParams() { return []; }

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Star, Clock, Utensils, AlertTriangle, UserPlus, UserCheck, BadgeCheck
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useFollow } from '@/hooks/useFollow';
import MealCard from '@/components/dine/MealCard';
import MealDetailModal from '@/components/dine/MealDetailModal';
import { AnimatePresence, motion } from 'framer-motion';

// Cuisine slug → gradient
const CUISINE_THEMES = {
  'cameroonian':         { from: '#ea580c', to: '#fbbf24' },
  'fast-food':           { from: '#dc2626', to: '#fb923c' },
  'chinese':             { from: '#b91c1c', to: '#f43f5e' },
  'pizza':               { from: '#c2410c', to: '#facc15' },
  'burgers':             { from: '#b45309', to: '#fb923c' },
  'shawarma':            { from: '#a16207', to: '#fcd34d' },
  'breakfast':           { from: '#ca8a04', to: '#fde68a' },
  'seafood':             { from: '#0369a1', to: '#22d3ee' },
  'vegetarian':          { from: '#166534', to: '#4ade80' },
  'desserts-and-drinks': { from: '#be185d', to: '#e879f9' },
  'desserts-pastries':   { from: '#9d174d', to: '#a78bfa' },
  'rice-fufu':           { from: '#92400e', to: '#fcd34d' },
  'grilled-roasted':     { from: '#7f1d1d', to: '#fb923c' },
  'sandwiches-wraps':    { from: '#14532d', to: '#86efac' },
  'sides-snacks':        { from: '#713f12', to: '#fde047' },
  'cold-drinks':         { from: '#155e75', to: '#67e8f9' },
  'hot-drinks':          { from: '#78350f', to: '#fb923c' },
};
const FALLBACK_GRADIENTS = [
  { from: '#ea580c', to: '#fbbf24' },
  { from: '#be185d', to: '#fb7185' },
  { from: '#7c3aed', to: '#c084fc' },
  { from: '#0f766e', to: '#2dd4bf' },
];
function strHash(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}
function getHeroTheme(cuisine_types = [], store_name = '') {
  for (const ct of cuisine_types) {
    if (ct.slug && CUISINE_THEMES[ct.slug]) return CUISINE_THEMES[ct.slug];
  }
  return FALLBACK_GRADIENTS[strHash(store_name) % FALLBACK_GRADIENTS.length];
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

const ALL_KEY = '__all__';

export default function RestaurantMenuPage() {
  const { vendor_id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [activeCatKey, setActiveCatKey] = useState(ALL_KEY);

  // Follow button — vendorId resolves to null until data loads (hook handles null gracefully)
  const followVendorId = data?.vendor?._id?.toString() || null;
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(followVendorId);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dine/restaurant/${vendor_id}`);
      if (res.data.success) setData(res.data.data);
    } catch {
      toast.error('Could not load restaurant menu.');
    } finally {
      setLoading(false);
    }
  }, [vendor_id]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Normalize product shape → MealDetailModal shape before opening
  const handleSelectMeal = (meal) => {
    setSelectedMeal({
      ...meal,
      thumbnail_url:       meal.images?.[0]?.url || meal.thumbnail_url || null,
      restaurant_name:     data?.vendor?.store_name || '',
      restaurant_logo_url: data?.vendor?.logo_url   || null,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center">
        <AlertTriangle className="size-10 text-[var(--text-secondary)] opacity-40" />
        <p className="text-[14px] lg:text-[16px] font-semibold text-[var(--text-secondary)]">Restaurant not found.</p>
        <button onClick={() => router.back()} className="text-orange-500 text-[13px] font-semibold">Go back</button>
      </div>
    );
  }

  const { vendor, profile, menu } = data;
  const isOpen = profile.open_status === 'open' && profile.is_accepting_orders;
  const heroTheme = getHeroTheme(profile.cuisine_types, vendor.store_name);
  const initial = (vendor.store_name || '?')[0].toUpperCase();

  // Flatten all meals; attach catKey for filtering
  const allMeals = menu.flatMap(cat => {
    const catKey = cat.category?._id?.toString() || cat.category?.name || 'other';
    return (cat.items || []).map(meal => ({ ...meal, _catKey: catKey, _catName: cat.category?.name || 'Other' }));
  });

  // Apply filter — "All" shows everything
  const visibleMeals = activeCatKey === ALL_KEY
    ? allMeals
    : allMeals.filter(m => m._catKey === activeCatKey);

  const totalItems = allMeals.length;

  return (
    <div className="w-full flex flex-col bg-[var(--bg-primary)]">

      {/* ── Hero banner ──────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: '220px' }}>
        {vendor.banner_url ? (
          <>
            <img
              src={vendor.banner_url}
              alt={vendor.store_name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${heroTheme.from} 0%, ${heroTheme.to} 100%)` }}
            />
            <div
              className="absolute inset-0 opacity-[0.1]"
              style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
            />
            <div className="absolute -bottom-16 -right-16 size-64 rounded-full opacity-20 blur-3xl" style={{ background: 'white' }} />
          </>
        )}

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 size-9 lg:size-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all hover:bg-black/50"
        >
          <ArrowLeft className="size-4 lg:size-5" />
        </button>

        <div className={`absolute top-4 right-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] lg:text-[12px] font-bold shadow-lg backdrop-blur-sm ${
          isOpen ? 'bg-emerald-500 text-white' : 'bg-black/55 text-white/85'
        }`}>
          {isOpen && <span className="size-1.5 rounded-full bg-white animate-pulse" />}
          {isOpen ? 'Open now' : 'Closed'}
        </div>
      </div>

      {/* ── Restaurant info card ─────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-10 xl:px-16 -mt-10 relative z-10">
        <div className="rounded-2xl lg:rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-xl shadow-xl p-4 lg:p-5">

          {/* Top row: logo + name + cuisine */}
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="size-[60px] lg:size-[72px] rounded-xl lg:rounded-2xl border-2 border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 overflow-hidden shadow-md">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.store_name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${heroTheme.from} 0%, ${heroTheme.to} 100%)` }}>
                  <span className="text-[26px] lg:text-[32px] font-black text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                    {initial}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] lg:text-[22px] font-black text-[var(--text-primary)] font-[Poppins] leading-tight">{vendor.store_name}</h1>
                {vendor.verified && (
                  <BadgeCheck className="size-5 lg:size-6 text-blue-500 shrink-0" title="Verified restaurant" />
                )}
              </div>
              {profile.cuisine_types.length > 0 && (
                <p className="mt-0.5 text-[12px] lg:text-[13px] text-[var(--text-secondary)] truncate">
                  {profile.cuisine_types.map(c => c.name).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Meta chips */}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] lg:text-[12px] text-[var(--text-secondary)]">
            {vendor.rating > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1">
                <Star className="size-3 fill-amber-500 text-amber-500 shrink-0" />
                <span className="font-bold text-amber-500">{vendor.rating.toFixed(1)}</span>
                {vendor.num_reviews > 0 && <span>({vendor.num_reviews})</span>}
              </div>
            )}
            {profile.prep_time_minutes && (
              <div className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-2.5 py-1">
                <Clock className="size-3 text-orange-400 shrink-0" />
                <span>{formatPrepTime(profile.prep_time_minutes)} prep</span>
              </div>
            )}
            {totalItems > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-2.5 py-1">
                <Utensils className="size-3 text-orange-400 shrink-0" />
                <span>{totalItems} dish{totalItems !== 1 ? 'es' : ''}</span>
              </div>
            )}
          </div>

          {/* Follow button — full width, prominent like shop page */}
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className={`mt-3 w-full h-10 lg:h-11 rounded-xl text-[12px] lg:text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${
              isFollowing
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/15'
                : 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20 hover:brightness-105'
            }`}
          >
            {isFollowing
              ? <><UserCheck className="size-4 shrink-0" /> Following</>
              : <><UserPlus className="size-4 shrink-0" /> Follow {vendor.store_name}</>
            }
          </button>

          {/* Alerts */}
          {!profile.delivery_available && (
            <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500 shrink-0" />
              <p className="text-[11px] lg:text-[13px] text-red-600 font-medium">Delivery is not available in your area at this time.</p>
            </div>
          )}
          {!isOpen && (
            <div className="mt-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2.5 flex items-center gap-2">
              <Clock className="size-4 text-[var(--text-secondary)] shrink-0" />
              <p className="text-[11px] lg:text-[13px] text-[var(--text-secondary)]">This restaurant is currently closed. Browse the menu below.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Category filter tabs (always shown when meals exist) ─────── */}
      {menu.length > 0 && (
        <div className="sticky top-[53px] md:top-[69px] lg:top-[65px] z-30 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--glass-border)] mt-4">
          <div className="px-4 sm:px-6 lg:px-10 xl:px-16">
            <div className="flex w-full overflow-x-auto no-scrollbar gap-2 py-2.5">

              {/* All tab */}
              <button
                onClick={() => setActiveCatKey(ALL_KEY)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] flex items-center gap-1.5 ${
                  activeCatKey === ALL_KEY
                    ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All
                <span className={`text-[9px] lg:text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                  activeCatKey === ALL_KEY ? 'bg-white/25 text-white' : 'bg-[var(--glass-border)] text-[var(--text-secondary)]'
                }`}>{totalItems}</span>
              </button>

              {/* One tab per category — only shown because categories are derived from actual meals */}
              {menu.map(cat => {
                const catKey = cat.category?._id?.toString() || cat.category?.name || 'other';
                const isActive = activeCatKey === catKey;
                const count = cat.items?.length || 0;
                return (
                  <button
                    key={catKey}
                    onClick={() => setActiveCatKey(catKey)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat.category?.name || 'Other'}
                    <span className={`text-[9px] lg:text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[var(--glass-border)] text-[var(--text-secondary)]'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Flat filtered meal grid ───────────────────────────────────── */}
      <main className="w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-5 lg:py-8 pb-32">

        {visibleMeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Utensils className="size-12 lg:size-14 text-[var(--text-secondary)] opacity-20 mb-4" />
            <p className="text-[15px] lg:text-[17px] font-semibold text-[var(--text-secondary)]">No dishes here yet</p>
          </div>
        ) : (
          <motion.div
            key={activeCatKey}
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4"
          >
            <AnimatePresence>
              {visibleMeals.map((meal, i) => (
                <motion.div
                  key={meal._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.14, delay: i * 0.025 }}
                >
                  <MealCard
                    meal={meal}
                    onSelect={handleSelectMeal}
                    vendorId={vendor._id?.toString()}
                    storeName={vendor.store_name}
                    logoUrl={vendor.logo_url}
                    prepTime={profile.prep_time_minutes}
                    unavailable={
                      !meal.meal?.is_available_today ||
                      !isOpen ||
                      !profile.delivery_available
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Meal detail modal */}
      <AnimatePresence>
        {selectedMeal && (
          <MealDetailModal
            key={selectedMeal._id}
            meal={selectedMeal}
            onClose={() => setSelectedMeal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
