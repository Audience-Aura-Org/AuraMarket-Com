"use client";

import { useState, useEffect } from 'react';
import { X, MapPin, ChevronRight, ArrowLeft, Search, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

export default function DistrictPicker({ selectedZone, onSelect, onClose }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // null = city list; zone object = district list for that city
  const [drillCity, setDrillCity] = useState(null);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await api.get('/logistics/zones');
        if (res.data.success) setZones(res.data.data.zones || []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchZones();
  }, []);

  // When the picker opens with a district already selected, auto-drill into
  // the parent city so the user can see their current district highlighted.
  useEffect(() => {
    if (!zones.length || !selectedZone) return;
    if (selectedZone.type !== 'district' && selectedZone.type !== 'quartier') return;
    if (!selectedZone.city_name || drillCity) return;
    const parentCity = zones.find(z =>
      (z.type === 'city' || z.type === 'region') &&
      z.name === selectedZone.city_name
    );
    if (parentCity) setDrillCity(parentCity);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, selectedZone]);

  // Treat both 'city' and 'region' (legacy) as top-level cities
  const cities = zones.filter(z => z.type === 'city' || z.type === 'region');

  const districtsForCity = drillCity
    ? zones.filter(z =>
        (z.type === 'district' || z.type === 'quartier') &&
        String(z.parent_id?._id ?? z.parent_id) === String(drillCity._id)
      )
    : [];

  const searchLower = search.toLowerCase();

  // ── City list (top level) ──────────────────────────────────────────────────
  const filteredCities = search
    ? cities.filter(c => c.name.toLowerCase().includes(searchLower))
    : cities;

  // ── District list (drilled in) ─────────────────────────────────────────────
  const filteredDistricts = search
    ? districtsForCity.filter(d => d.name.toLowerCase().includes(searchLower))
    : districtsForCity;

  const handleDrillIn = (city) => {
    setDrillCity(city);
    setSearch('');
  };

  const handleBack = () => {
    setDrillCity(null);
    setSearch('');
  };

  const isSelected = (z) => selectedZone?._id?.toString() === z._id?.toString();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[700] max-h-[80vh] overflow-hidden rounded-t-[24px] bg-[var(--bg-primary)] border-t border-[var(--glass-border)] shadow-2xl pb-[env(safe-area-inset-bottom,16px)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--glass-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {drillCity && (
              <button
                onClick={handleBack}
                className="text-orange-500 text-[12px] font-semibold flex items-center gap-1 mr-1"
              >
                <ArrowLeft className="size-3.5" /> Cities
              </button>
            )}
            <h2 className="text-[15px] font-bold text-[var(--text-primary)] font-[Poppins]">
              {drillCity ? `${drillCity.name}` : 'Choose your city'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            <X className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)] opacity-40" />
            <input
              type="text"
              placeholder={drillCity ? `Search districts in ${drillCity.name}...` : 'Search city...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-9 pr-3 text-[12px] text-[var(--text-primary)] placeholder:opacity-40 outline-none focus:border-orange-500/40 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: 'calc(80vh - 180px)' }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="size-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            </div>
          ) : !drillCity ? (
            /* ── City list ── */
            <div className="space-y-1">
              {filteredCities.map(city => (
                <div key={city._id} className="flex items-stretch gap-1">
                  {/* Tap city name = select whole city */}
                  <button
                    onClick={() => onSelect({ _id: city._id, name: city.name, type: city.type })}
                    className={`flex-1 flex items-center gap-2.5 rounded-xl px-3 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-left ${
                      isSelected(city) ? 'bg-orange-500/10 ring-1 ring-orange-500/30' : ''
                    }`}
                  >
                    <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                      <LayoutGrid className="size-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[Poppins]">{city.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">All restaurants</p>
                    </div>
                    {isSelected(city) && (
                      <span className="ml-auto text-[10px] font-bold text-orange-500">Selected</span>
                    )}
                  </button>
                  {/* Chevron = drill into districts */}
                  <button
                    onClick={() => handleDrillIn(city)}
                    className="flex items-center justify-center rounded-xl px-3 hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)] hover:text-orange-500"
                    title={`Filter by district in ${city.name}`}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              ))}
              {filteredCities.length === 0 && (
                <p className="text-center py-8 text-[12px] text-[var(--text-secondary)]">No cities found.</p>
              )}
            </div>
          ) : (
            /* ── District list ── */
            <div className="space-y-1">
              {/* "All of [City]" option at top */}
              <button
                onClick={() => onSelect({ _id: drillCity._id, name: drillCity.name, type: drillCity.type })}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-left ${
                  isSelected(drillCity) ? 'bg-orange-500/10 ring-1 ring-orange-500/30' : 'border border-dashed border-[var(--glass-border)]'
                }`}
              >
                <div className="size-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                  <LayoutGrid className="size-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[Poppins]">All of {drillCity.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Show every restaurant in {drillCity.name}</p>
                </div>
                {isSelected(drillCity) && (
                  <span className="ml-auto text-[10px] font-bold text-orange-500">Selected</span>
                )}
              </button>

              {/* District separator */}
              {filteredDistricts.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 whitespace-nowrap">By district</span>
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                </div>
              )}

              {filteredDistricts.map(district => (
                <button
                  key={district._id}
                  onClick={() => onSelect({ _id: district._id, name: district.name, type: district.type, city_name: drillCity.name })}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-left ${
                    isSelected(district) ? 'bg-orange-500/10 ring-1 ring-orange-500/30' : ''
                  }`}
                >
                  <div className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center shrink-0">
                    <MapPin className="size-4 text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[Poppins]">{district.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">District · {drillCity.name}</p>
                  </div>
                  {isSelected(district) && (
                    <span className="ml-auto text-[10px] font-bold text-orange-500">Selected</span>
                  )}
                </button>
              ))}

              {filteredDistricts.length === 0 && !search && (
                <p className="text-center py-6 text-[12px] text-[var(--text-secondary)]">
                  No districts found in {drillCity.name}.
                </p>
              )}
              {filteredDistricts.length === 0 && search && (
                <p className="text-center py-6 text-[12px] text-[var(--text-secondary)]">
                  No districts match &ldquo;{search}&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
