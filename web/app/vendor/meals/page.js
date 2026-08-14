"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, Utensils, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';

export default function MealsListPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const hasHydrated = useAuthStore(s => s.hasHydrated);

  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');

  const fetchMeals = useCallback(async () => {
    try {
      const res = await api.get('/vendors/products', { skipClientCache: true });
      if (res.data.success) {
        const products = res.data.data.products || res.data.data.items || [];
        setMeals(products.filter(p => !!p.meal));
      }
    } catch (err) {
      toast.error('Could not load meals.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'vendor') fetchMeals();
  }, [user, fetchMeals]);

  const handleToggleAvailability = async (meal) => {
    if (toggling === meal._id) return;
    setToggling(meal._id);
    try {
      const newVal = !(meal.meal?.is_available_today ?? true);
      const fd = new FormData();
      fd.append('meal', JSON.stringify({ is_available_today: newVal }));
      await api.patch(`/products/${meal._id}`, fd);
      setMeals(prev => prev.map(m =>
        m._id === meal._id
          ? { ...m, meal: { ...m.meal, is_available_today: newVal } }
          : m
      ));
      toast.success(newVal ? 'Meal marked available' : 'Meal marked unavailable');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update availability');
    } finally {
      setToggling(null);
    }
  };

  if (!hasHydrated || !user || user.role !== 'vendor') return null;

  const filtered = meals.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 md:top-16 lg:top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Utensils className="size-4 text-orange-500" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight font-[Poppins]">My Meals</h1>
            <p className="text-[10px] text-[var(--text-secondary)] hidden sm:block">
              {meals.length} menu item{meals.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/vendor/meals/add"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-[11px] font-bold shadow-md shadow-orange-500/25 hover:opacity-90 transition-all"
        >
          <Plus className="size-3.5" />
          Add Meal
        </Link>
      </header>

      <div className="mx-auto max-w-[800px] px-4 py-5 sm:px-6 pb-32 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-50" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meals..."
            className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] pl-9 pr-4 py-2.5 text-[12px] outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
              <Utensils className="size-8 text-orange-500 opacity-50" />
            </div>
            <h3 className="text-[15px] font-bold font-[Poppins] mb-1">
              {search ? 'No meals found' : 'No meals yet'}
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)] mb-5">
              {search ? 'Try a different search term.' : 'Add your first menu item to get started.'}
            </p>
            {!search && (
              <Link
                href="/vendor/meals/add"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-[12px] font-bold shadow-md shadow-orange-500/25 hover:opacity-90 transition-all"
              >
                <Plus className="size-4" />
                Add First Meal
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(meal => {
              const isAvailable = meal.meal?.is_available_today ?? true;
              const thumb = Array.isArray(meal.images) && meal.images[0]
                ? (typeof meal.images[0] === 'string' ? meal.images[0] : meal.images[0].url || meal.images[0].location)
                : null;

              return (
                <div
                  key={meal._id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-3 hover:border-orange-500/20 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="size-14 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0">
                    {thumb ? (
                      <img src={thumb} alt={meal.name} className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <Utensils className="size-5 text-[var(--text-secondary)] opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-primary)] truncate font-[Poppins]">
                      {meal.name}
                    </p>
                    <p className="text-[11px] text-orange-500 font-semibold mt-0.5">
                      {Number(meal.price).toLocaleString()} XAF
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isAvailable
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-slate-500/10 text-[var(--text-secondary)]'
                      }`}>
                        {isAvailable ? 'Available today' : 'Unavailable'}
                      </span>
                      {meal.meal?.spice_level && meal.meal.spice_level !== 'none' && (
                        <span className="text-[10px] text-[var(--text-secondary)] capitalize opacity-60">
                          🌶 {meal.meal.spice_level}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(meal)}
                      disabled={toggling === meal._id}
                      title={isAvailable ? 'Mark unavailable' : 'Mark available'}
                      className="p-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-orange-500/30 hover:text-orange-500 transition-all disabled:opacity-50"
                    >
                      {isAvailable
                        ? <ToggleRight className="size-4 text-emerald-500" />
                        : <ToggleLeft className="size-4" />
                      }
                    </button>
                    <Link
                      href={`/vendor/meals/edit/${meal._id}`}
                      className="p-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-orange-500/30 hover:text-orange-500 transition-all"
                    >
                      <Pencil className="size-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
