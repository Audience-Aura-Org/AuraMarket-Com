'use client';
/**
 * One address field for the whole app: the account's saved addresses as one-tap
 * choices, then a single place search (with map pin) and an optional description.
 * Addresses used at checkout, for packages and P2P are saved automatically on the
 * server (up to 5); they can be changed or removed in Profile → Addresses.
 *
 * value / onChange: LocationPicker's shape plus `address_id` (the saved address
 * chosen, cleared as soon as the spot is changed by hand).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, MapPin } from 'lucide-react';
import api from '@/services/api';
import LocationPicker from './LocationPicker';

let cache = null; // one request shared by every field on the page
export const loadSavedAddresses = (fresh = false) => {
  if (!cache || fresh) cache = api.get('/addresses', { skipClientCache: true }).then((r) => r.data?.data?.addresses || []).catch(() => { cache = null; return []; });
  return cache;
};

/** A saved address in the field's shape. */
export const spotFromSaved = (a) => ({
  address_id: a._id,
  zone_id: a.zone_id || '',
  quartier: a.quartier || '',
  city: a.city || '',
  place_name: a.place_name || '',
  landmark: a.landmark_description || '',
  location: a.location?.lat != null ? { lat: a.location.lat, lng: a.location.lng, source: 'saved' } : null,
  recipient_name: a.recipient_name || '',
  contact_phone: a.contact_phone || '',
});

/** Short line for a saved address: place, quartier, city. */
export const savedLine = (a) => [a.place_name, a.quartier, a.city].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ');

export default function AddressField({ label = 'Address', value = {}, onChange, showSaved = true, onSavedLoaded }) {
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    if (!showSaved) return;
    let active = true;
    loadSavedAddresses().then((list) => { if (active) { setSaved(list); onSavedLoaded?.(list); } });
    return () => { active = false; };
  }, [showSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = saved.filter((a) => a._id !== 'vendor_pickup');
  return (
    <div className="space-y-2.5">
      {showSaved && usable.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-[var(--text-primary)]">{label}: saved</p>
            <Link href="/profile?tab=addresses" className="text-[11px] font-semibold text-[var(--accent)]">Manage</Link>
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={`${label}: saved addresses`}>
            {usable.map((a) => {
              const active = value.address_id === a._id;
              return (
                <button key={a._id} type="button" role="option" aria-selected={active} onClick={() => onChange(spotFromSaved(a))}
                  className={`flex min-w-[150px] max-w-[210px] shrink-0 items-start gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40'}`}>
                  {active ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" /> : <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--text-secondary)]" />}
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold">{a.label || a.place_name || a.quartier || 'Address'}</span>
                    <span className="block truncate text-[10px] text-[var(--text-secondary)]">{savedLine(a) || 'No place yet'}</span>
                    {a.landmark_description && <span className="block truncate text-[10px] text-[var(--text-secondary)] opacity-80">{a.landmark_description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <LocationPicker
        label={showSaved && usable.length ? 'Or search a new place' : label}
        value={value}
        onChange={(v) => {
          // Editing the description keeps the saved address; moving the spot makes it a new one.
          const moved = v.location?.lat !== value.location?.lat || v.location?.lng !== value.location?.lng || v.zone_id !== value.zone_id;
          onChange(moved ? { ...v, address_id: '' } : v);
        }}
      />
    </div>
  );
}
