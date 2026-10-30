'use client';
/**
 * Location picker: search (places, quartiers, districts, cities), "use my location"
 * as a suggestion only, and a map pin the customer confirms. District pricing stays
 * authoritative: the result always carries the quartier `zone_id`; the pin only
 * records the exact spot. Ambiguous pins ask the customer to confirm the quartier.
 *
 * value / onChange shape:
 *   { zone_id, quartier, district, city, location: { lat, lng, source } | null,
 *     place_name (the place chosen in the search), landmark (optional description) }
 */
import { useEffect, useRef, useState } from 'react';
import withMapFallback from './withMapFallback';
import { Building2, Check, Crosshair, Landmark, Loader2, MapPin, Search, X } from 'lucide-react';
import api from '@/services/api';

// Google Maps when a key is configured, else the free MapLibre map.
const PinMap = withMapFallback(() => import('./google/GooglePinMap'), () => import('./PinMap'),
  () => <div className="flex h-56 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[11px] text-[var(--text-secondary)] sm:h-64">Loading map…</div>);

const KIND_LABEL = { quartier: 'Quartier', district: 'District', city: 'City', region: 'Region', place: 'Landmark' };
const placeLine = (r) => [r.quartier, r.district, r.city].filter((v, i, a) => v && a.indexOf(v) === i && v !== r.name).join(' · ');

// What the search box shows for a chosen spot (like ride-hailing apps keep it there).
const spotLabel = (v) => [v.place_name, v.quartier].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
// One id per typing session: Google bills a session's suggestions and the pick once.
const newSession = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s${Date.now()}${Math.random().toString(36).slice(2, 10)}`);

export default function LocationPicker({ value = {}, onChange, label = 'Location' }) {
  const [query, setQuery] = useState(() => spotLabel(value));
  const shown = useRef(spotLabel(value)); // text we put in the box ourselves: not a search
  const session = useRef(newSession());
  const [picking, setPicking] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(Boolean(value.location));
  const [center, setCenter] = useState(null);
  const [resolution, setResolution] = useState(null); // { zone, needs_confirmation, alternatives }
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const resolveSeq = useRef(0);
  const update = (patch) => onChange({ ...value, ...patch });

  // A spot chosen elsewhere (a saved address): show it in the box unless they are typing.
  const label_ = spotLabel(value);
  useEffect(() => {
    const before = shown.current; // read now: the updater below runs later
    shown.current = label_;
    setQuery((q) => (q === before || !q.trim() ? label_ : q));
  }, [label_]);

  // Debounced search-as-you-type.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || query === shown.current) { setResults([]); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const near = value.location || null;
        const res = await api.get('/locations/search', { params: { q, session: session.current, ...(near ? { lat: near.lat, lng: near.lng } : {}) } });
        if (active) setResults(res?.data?.data?.results || []);
      } catch { if (active) setResults([]); }
      finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const applyZone = (zone, location = value.location, base = value) => onChange({
    ...base, zone_id: zone.zone_id, quartier: zone.name, district: zone.district || '', city: zone.city || '', location,
  });

  // A spot from the search keeps the place's name; a dropped pin or GPS fix clears it.
  const resolvePin = async (point, source, placeName = '') => {
    const location = { lat: point.lat, lng: point.lng, source };
    const base = { ...value, place_name: placeName };
    onChange({ ...base, location });
    const seq = ++resolveSeq.current;
    try {
      const res = await api.get('/locations/resolve', { params: { lat: point.lat, lng: point.lng } });
      if (seq !== resolveSeq.current) return;
      const data = res?.data?.data;
      setResolution(data);
      if (data?.zone && !data.needs_confirmation) applyZone(data.zone, location, base);
      else onChange({ ...base, location, zone_id: '', quartier: '' });
      setError('');
    } catch (err) {
      if (seq === resolveSeq.current) setError(err?.response?.data?.message || 'Could not check this spot. Choose the quartier below.');
    }
  };

  const showInBox = (text) => { shown.current = text; setQuery(text); };

  const choose = async (r) => {
    setResults([]); setResolution(null); setShowMap(true);
    showInBox([r.name, r.kind === 'place' ? r.quartier : null].filter(Boolean).join(', '));
    if (r.google_place_id && !r.point) {
      // A Google place: its exact position is fetched only now that it is picked.
      setPicking(true);
      try {
        const res = await api.get(`/locations/place/${encodeURIComponent(r.google_place_id)}`, { params: { session: session.current } });
        const place = res?.data?.data?.place;
        session.current = newSession();
        if (place?.point) { setCenter(place.point); resolvePin(place.point, 'search', place.name || r.name); }
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not open this place. Try another or drop the pin.');
      } finally { setPicking(false); }
      return;
    }
    session.current = newSession();
    if (r.zone_id) {
      // A quartier or a landmark: already tied to a priced quartier.
      const location = r.point ? { lat: r.point.lat, lng: r.point.lng, source: 'search' } : null;
      onChange({ ...value, zone_id: r.zone_id, quartier: r.kind === 'place' ? r.quartier : r.name, district: r.district || '', city: r.city || '', location,
        place_name: r.kind === 'place' ? r.name : '' });
    } else if (r.kind === 'place' && r.point) {
      // A street, landmark or business from the place search: exact spot, quartier
      // looked up from it (asks the customer if it sits between two quartiers).
      setCenter(r.point);
      resolvePin(r.point, 'search', r.name);
    } else if (r.point) {
      setCenter(r.point); // City or district: move the map there and let them drop the pin.
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('This device cannot share its location. Search or tap the map instead.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setShowMap(true); resolvePin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps'); },
      () => { setLocating(false); setError('Location permission was not given. Search or tap the map instead.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const pin = value.location ? { lat: value.location.lat, lng: value.location.lng } : null;
  const choices = resolution?.needs_confirmation ? [resolution.zone, ...(resolution.alternatives || [])].filter(Boolean) : [];

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] font-medium text-[var(--text-primary)]">{label}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place, street, landmark or quartier"
          aria-label={`${label}: search`}
          className="min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-10 pr-10 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[12px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
        />
        {searching || picking
          ? <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--text-secondary)]" aria-hidden="true" />
          : query && <button type="button" aria-label="Clear the search" onClick={() => { shown.current = ''; setQuery(''); }} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--accent)]/10"><X className="size-4" /></button>}
        {results.length > 0 && (
          <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] py-1 shadow-lg">
            {results.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button type="button" role="option" aria-selected="false" onClick={() => choose(r)} className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-[var(--accent)]/5">
                  {r.kind === 'place' ? <Landmark className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" /> : r.kind === 'quartier' ? <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" /> : <Building2 className="mt-0.5 size-4 shrink-0 text-[var(--text-secondary)]" />}
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{r.name}</span>
                    <span className="block truncate text-[10px] text-[var(--text-secondary)]">{r.address || <>{r.place_kind === 'street' ? 'Street' : KIND_LABEL[r.kind]}{placeLine(r) ? ` · ${placeLine(r)}` : ''}</>}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 disabled:opacity-50">
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5 text-[var(--accent)]" />} Use my current location
        </button>
        {!showMap && (
          <button type="button" onClick={() => setShowMap(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40">
            <MapPin className="size-3.5 text-[var(--accent)]" /> Choose on map
          </button>
        )}
      </div>

      {showMap && <PinMap pin={pin} center={center} onPinChange={(p) => resolvePin(p, 'pin')} />}

      {choices.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 text-[11px] font-medium text-[var(--text-primary)]">
            {resolution.reason === 'far_from_known_quartiers' ? 'This spot is outside the quartiers we know well. Which quartier is it in?' : 'Which quartier is this spot in?'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((z) => (
              <button key={z.zone_id} type="button" onClick={() => { applyZone(z); setResolution(null); }} className="min-h-9 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]">
                {z.name}{z.city ? <span className="font-normal text-[var(--text-secondary)]"> · {z.city}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.zone_id && (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="text-[11px]">{value.place_name ? <span className="font-semibold text-[var(--text-primary)]">{value.place_name} · </span> : null}<span className="font-semibold text-[var(--text-primary)]">{value.quartier}</span>{value.city ? ` · ${value.city}` : ''}{value.location ? ' · exact spot pinned' : ''}</span>
          {value.location && <button type="button" aria-label="Remove pin" onClick={() => update({ location: null })} className="ml-1 rounded-full p-1 hover:bg-[var(--accent)]/10"><X className="size-3" /></button>}
        </p>
      )}

      <input
        value={value.landmark || ''}
        onChange={(e) => update({ landmark: e.target.value.slice(0, 200) })}
        placeholder="Address description (optional), e.g. blue gate after the pharmacy"
        aria-label={`${label}: address description (optional)`}
        className="min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[12px] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
      />
      {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
