"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Search, X as XIcon, Utensils, Store } from 'lucide-react';
import api from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import RestaurantCard from '@/components/dine/RestaurantCard';
import DineMealCard from '@/components/dine/DineMealCard';
import MealDetailModal from '@/components/dine/MealDetailModal';
import DistrictPicker from '@/components/dine/DistrictPicker';
import { useAuthStore } from '@/hooks/useAuth';

const ZONE_KEY = 'dine_zone';

export default function DinePage() {
  const { user } = useAuthStore();
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');

  // zone: always null on server and client initially (zero hydration mismatch).
  // The mount useEffect reads localStorage and calls setZone, which triggers a
  // normal React re-render — no suppressHydrationWarning or mounted-gate needed.
  const [zone, setZone] = useState(null);

  // mounted guards <main>: server and client both render a spinner until this
  // flips true, preventing the structural branch mismatch that crashed React.
  const [mounted, setMounted] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeMealCategoryId, setActiveMealCategoryId] = useState(null);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [visibleMealsCount, setVisibleMealsCount] = useState(12);
  const carouselRef  = useRef(null);
  const sentinelRef  = useRef(null);

  // After mount: read zone from localStorage via a proper setState call so React
  // guarantees the re-render. No lazy-init / suppressHydrationWarning needed.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ZONE_KEY);
      if (saved) setZone(JSON.parse(saved));
    } catch {}
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: Auto-resolve from user profile only when auth hydrates AND no zone is saved.
  useEffect(() => {
    if (!user) return;
    // Don't auto-resolve if the user has already explicitly selected a zone.
    try {
      if (localStorage.getItem(ZONE_KEY)) return;
    } catch {}

    const resolveUserCity = async () => {
      try {
        const res = await api.get('/logistics/zones');
        if (!res.data.success) return;
        const all = res.data.data.zones || [];
        const cityZones = all.filter(z => z.type === 'city' || z.type === 'region');

        let resolved = null;

        // 1. Try user's default_zone_id first (most precise — could be a district)
        if (user?.default_zone_id) {
          const defaultZoneId = String(user.default_zone_id?._id ?? user.default_zone_id);
          const defaultZone = all.find(z => String(z._id) === defaultZoneId);
          if (defaultZone) {
            if (defaultZone.type === 'city' || defaultZone.type === 'region') {
              resolved = { _id: defaultZone._id, name: defaultZone.name, type: defaultZone.type };
            } else {
              const parentId = String(defaultZone.parent_id?._id ?? defaultZone.parent_id);
              const parentCity = all.find(z => String(z._id) === parentId);
              resolved = {
                _id:       defaultZone._id,
                name:      defaultZone.name,
                type:      defaultZone.type,
                city_name: parentCity?.name || defaultZone.name,
              };
            }
          }
        }

        // 2. Fallback: match city name from onboarding location
        if (!resolved) {
          const locationCity = user?.onboarding_location?.city;
          if (locationCity) {
            const cityZone = cityZones.find(c =>
              c.name.toLowerCase() === locationCity.toLowerCase()
            );
            if (cityZone) {
              resolved = { _id: cityZone._id, name: cityZone.name, type: cityZone.type };
            }
          }
        }

        if (resolved) {
          // Guard: don't override if the user selected a zone while we were fetching.
          try { if (localStorage.getItem(ZONE_KEY)) return; } catch {}
          setZone(resolved);
          try { localStorage.setItem(ZONE_KEY, JSON.stringify(resolved)); } catch {}
        }
      } catch {
        // non-fatal
      }
    };

    resolveUserCity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchDine = useCallback(async (zoneId, mealCatId, closed) => {
    if (!zoneId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ zone_id: zoneId });
      if (mealCatId) params.set('meal_category', mealCatId);
      if (closed) params.set('include_closed', 'true');
      const res = await api.get(`/dine?${params.toString()}`);
      if (res.data.success) setData(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Use zone._id (string) not zone (object) so district changes reliably re-trigger.
  const zoneId = zone?._id ?? null;
  useEffect(() => {
    if (zoneId) fetchDine(zoneId, activeMealCategoryId, includeClosed);
  }, [zoneId, activeMealCategoryId, includeClosed, fetchDine]);

  const handleZoneSelect = (newZone) => {
    setData(null);
    setZone(newZone);
    setShowPicker(false);
    setActiveMealCategoryId(null);
    setSearchQuery('');
    try { localStorage.setItem(ZONE_KEY, JSON.stringify(newZone)); } catch {}
    // Call directly so same-zone re-selection also refreshes data
    // (the zoneId effect won't re-fire if the zone _id hasn't changed).
    fetchDine(newZone._id, null, includeClosed);
  };

  const scrollCarousel = (dir) => {
    if (!carouselRef.current) return;
    const amount = carouselRef.current.offsetWidth * 0.75;
    carouselRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const restaurants    = data?.restaurants     || [];
  const meals          = data?.meals           || [];
  const mealCategories = data?.meal_categories || [];
  const cityName = zone
    ? (zone.city_name ? `${zone.name} · ${zone.city_name}` : zone.name)
    : '';

  // Search — client-side filter across restaurants and meals
  const query              = searchQuery.trim().toLowerCase();
  const isSearching        = !!query;
  const filteredRestaurants = isSearching
    ? restaurants.filter(r =>
        r.store_name?.toLowerCase().includes(query) ||
        r.cuisine_types?.some(c => c.name?.toLowerCase().includes(query))
      )
    : restaurants;
  const filteredMeals = isSearching
    ? meals.filter(m =>
        m.name?.toLowerCase().includes(query) ||
        m.restaurant_name?.toLowerCase().includes(query)
      )
    : meals;

  // Reset visible count when filter/search changes
  useEffect(() => { setVisibleMealsCount(12); }, [query, activeMealCategoryId, zoneId]);

  // Infinite scroll sentinel — loads 12 more when bottom comes into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleMealsCount < filteredMeals.length) {
          setVisibleMealsCount(c => Math.min(c + 12, filteredMeals.length));
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleMealsCount, filteredMeals.length]);

  const visibleMeals = filteredMeals.slice(0, visibleMealsCount);
  const hasMoreMeals = visibleMealsCount < filteredMeals.length;

  return (
    <div className="w-full flex flex-col bg-[var(--bg-primary)]">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <header className="sticky top-0 md:top-16 lg:top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-2xl">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

        <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-3 lg:py-4">

          {/* Brand row + city picker */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 lg:size-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20 shrink-0">
                <Utensils className="size-5 lg:size-6" />
              </div>
              <div>
                <h1 className="text-base lg:text-xl font-bold text-[var(--text-primary)] font-[Poppins]">Dine</h1>
                <p className="text-[10px] lg:text-[13px] text-[var(--text-secondary)] opacity-60 font-[Poppins]">
                  Order food from local restaurants
                </p>
              </div>
            </div>

            {/* City picker trigger — zone starts null on both server and client,
                so cityName is '' on first render (no hydration mismatch).
                After the mount useEffect sets zone from localStorage, setZone()
                fires a normal React re-render and the button updates immediately. */}
            {/* key forces React to replace the DOM element when zone changes,
                bypassing the stale GPU compositing layer on sticky+backdrop-blur headers */}
            <button
              key={zone?._id || 'no-zone'}
              onClick={() => setShowPicker(true)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 lg:px-4 lg:py-2.5 transition-all active:scale-95 min-w-0 ${
                zone && cityName
                  ? 'border-orange-500 bg-orange-500 hover:bg-orange-600 hover:border-orange-600 shadow-md shadow-orange-500/25'
                  : 'border-orange-500/25 bg-orange-500/8 hover:bg-orange-500/15 hover:border-orange-500/40'
              }`}
            >
              <div className={`size-7 lg:size-8 rounded-xl flex items-center justify-center shrink-0 ${
                zone && cityName
                  ? 'bg-white/20 border border-white/30'
                  : 'bg-orange-500/15 border border-orange-500/25'
              }`}>
                <MapPin className={`size-3.5 lg:size-4 ${zone && cityName ? 'text-white' : 'text-orange-400'}`} />
              </div>
              <span className={`text-[11px] lg:text-[14px] font-bold leading-tight truncate max-w-[120px] sm:max-w-[200px] lg:max-w-xs ${
                zone && cityName ? 'text-white' : 'text-[var(--text-primary)]'
              }`}>
                {cityName || 'Choose city'}
              </span>
              <ChevronDown className={`size-3.5 lg:size-4 shrink-0 opacity-60 ${zone && cityName ? 'text-white' : 'text-orange-400'}`} />
            </button>
          </div>

          {/* Category filter bar — same categories used during meal upload */}
          {mealCategories.length > 0 && (
            <div className="mt-3 lg:mt-4">
              <div className="flex w-full overflow-x-auto no-scrollbar gap-2 py-1">
                <button
                  onClick={() => setActiveMealCategoryId(null)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] ${
                    !activeMealCategoryId
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                  }`}
                >
                  All
                </button>
                {mealCategories.map(cat => (
                  <button
                    key={cat._id}
                    onClick={() => setActiveMealCategoryId(cat._id)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-semibold transition-all whitespace-nowrap font-[Poppins] ${
                      activeMealCategoryId === cat._id
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="w-full flex-1 pb-32">

        {/* Not yet mounted — server and client both render this spinner initially */}
        {!mounted ? (
          <div className="flex justify-center py-24">
            <div className="size-9 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>

        ) : !zone ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="size-20 lg:size-24 rounded-3xl bg-orange-500/10 flex items-center justify-center mb-5">
              <MapPin className="size-10 lg:size-12 text-orange-500" />
            </div>
            <h2 className="text-[18px] lg:text-[24px] font-bold text-[var(--text-primary)] font-[Poppins] mb-2">
              Choose your city
            </h2>
            <p className="text-[13px] lg:text-[15px] text-[var(--text-secondary)] mb-7 max-w-sm">
              Select your city to see restaurants and meals available near you.
            </p>
            <button
              onClick={() => setShowPicker(true)}
              className="rounded-2xl bg-orange-500 text-white px-8 py-3.5 text-[14px] lg:text-[15px] font-bold font-[Poppins] shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
            >
              Select city
            </button>
          </div>

        ) : loading ? (
          <div className="flex justify-center py-24">
            <div className="size-9 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>

        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <Store className="size-12 lg:size-14 text-[var(--text-secondary)] opacity-25 mb-4" />
            <p className="text-[15px] lg:text-[17px] font-semibold text-[var(--text-secondary)]">No restaurants found</p>
            <p className="text-[12px] lg:text-[14px] text-[var(--text-secondary)] opacity-60 mt-1.5">
              {activeMealCategoryId
                ? 'Try a different category filter'
                : cityName
                ? `No restaurants available in ${cityName}`
                : 'No restaurants are currently open in this area'}
            </p>
            {!includeClosed && (
              <button
                onClick={() => setIncludeClosed(true)}
                className="mt-5 rounded-xl border border-[var(--glass-border)] px-5 py-2.5 text-[12px] lg:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                Show closed restaurants too
              </button>
            )}
          </div>

        ) : (
          <>
            {/* ── Search bar ──────────────────────────────────────────── */}
            <div className="pt-5 lg:pt-6 px-4 sm:px-6 lg:px-10 xl:px-16">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search restaurants or dishes..."
                  className="w-full h-12 lg:h-13 pl-11 pr-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[13px] lg:text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── SECTION 1: Restaurants ──────────────────────────────── */}
            {(!isSearching || filteredRestaurants.length > 0) && (
              <section className="pt-5 lg:pt-7 px-4 sm:px-6 lg:px-10 xl:px-16">
                <div className="flex items-center justify-between mb-3 lg:mb-4">
                  <div>
                    <h2 className="text-[15px] lg:text-[18px] font-bold text-[var(--text-primary)] font-[Poppins]">
                      {isSearching ? 'Restaurants' : 'Top Restaurants'}
                      {cityName ? <span className="text-orange-500"> · {cityName}</span> : ''}
                    </h2>
                    <p className="text-[11px] lg:text-[13px] text-[var(--text-secondary)] mt-0.5">
                      {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
                      {isSearching ? ' found' : ' available'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSearching && !includeClosed && (
                      <button
                        onClick={() => setIncludeClosed(true)}
                        className="text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] transition-colors"
                      >
                        Show closed
                      </button>
                    )}
                    {!isSearching && (
                      <>
                        <button
                          onClick={() => fetchDine(zone._id, activeMealCategoryId, includeClosed)}
                          className="size-8 lg:size-9 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-orange-500 transition-all"
                        >
                          <RefreshCw className="size-3.5 lg:size-4" />
                        </button>
                        <button
                          onClick={() => scrollCarousel('left')}
                          className="hidden lg:flex size-8 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] items-center justify-center text-[var(--text-secondary)] hover:text-orange-500 transition-all"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <button
                          onClick={() => scrollCarousel('right')}
                          className="hidden lg:flex size-8 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] items-center justify-center text-[var(--text-secondary)] hover:text-orange-500 transition-all"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isSearching ? (
                  /* Search results → circle grid */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
                    {filteredRestaurants.map(r => (
                      <RestaurantCard key={r.vendor_id} restaurant={r} />
                    ))}
                  </div>
                ) : (
                  /* Browse → circle grid, max 6 */
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
                    {restaurants.slice(0, 6).map(r => (
                      <RestaurantCard key={r.vendor_id} restaurant={r} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── SECTION 2: Meals ────────────────────────────────────── */}
            {(!isSearching ? meals.length > 0 : filteredMeals.length > 0) && (
              <section className="pt-8 lg:pt-10 px-4 sm:px-6 lg:px-10 xl:px-16">
                <div className="flex items-center justify-between mb-3 lg:mb-4">
                  <div>
                    <h2 className="text-[15px] lg:text-[18px] font-bold text-[var(--text-primary)] font-[Poppins]">
                      {isSearching ? 'Dishes' : 'Popular Dishes'}
                      {cityName ? <span className="text-orange-500"> · {cityName}</span> : ''}
                    </h2>
                    <p className="text-[11px] lg:text-[13px] text-[var(--text-secondary)] mt-0.5">
                      {filteredMeals.length} dish{filteredMeals.length !== 1 ? 'es' : ''}
                      {isSearching ? ' found' : ' available'}
                    </p>
                  </div>
                </div>

                <motion.div
                  layout
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4"
                >
                  <AnimatePresence>
                    {visibleMeals.map((meal, i) => (
                      <motion.div
                        key={meal._id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16, delay: (i % 12) * 0.02 }}
                      >
                        <DineMealCard meal={meal} onSelect={setSelectedMeal} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="mt-4 flex justify-center">
                  {hasMoreMeals && (
                    <div className="size-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                  )}
                  {!hasMoreMeals && filteredMeals.length > 12 && (
                    <p className="text-[11px] lg:text-[12px] text-[var(--text-secondary)] opacity-50">
                      All {filteredMeals.length} dishes loaded
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* No results when searching */}
            {isSearching && filteredRestaurants.length === 0 && filteredMeals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <Search className="size-12 lg:size-14 text-[var(--text-secondary)] opacity-20 mb-4" />
                <p className="text-[15px] lg:text-[17px] font-semibold text-[var(--text-secondary)]">No results for "{searchQuery}"</p>
                <p className="text-[12px] lg:text-[14px] text-[var(--text-secondary)] opacity-60 mt-1.5">Try a different restaurant name, cuisine, or dish</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-5 rounded-xl bg-orange-500 text-white px-6 py-2.5 text-[12px] lg:text-[13px] font-semibold active:scale-95 transition-all"
                >
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* City / district picker sheet */}
      <AnimatePresence>
        {showPicker && (
          <DistrictPicker
            selectedZone={zone}
            onSelect={handleZoneSelect}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Meal detail bottom sheet */}
      <AnimatePresence>
        {selectedMeal && (
          <MealDetailModal
            meal={selectedMeal}
            onClose={() => setSelectedMeal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
