/**
 * Rider preferences kept on this phone (browser storage): which navigation app opens
 * for directions, how new offers alert, and keeping the screen on during a delivery.
 * Per-device conveniences only; nothing here is needed by the server.
 */
import { useEffect, useState } from 'react';

const KEY = 'aura-rider-prefs';
const EVENT = 'aura:rider-prefs';
export const DEFAULT_PREFS = { nav_app: 'google', offer_sound: true, offer_vibrate: true, keep_awake: true };

export const readRiderPrefs = () => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
};

export const saveRiderPrefs = (patch) => {
  const next = { ...readRiderPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: keep for this page only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  return next;
};

export function useRiderPrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(readRiderPrefs());
    const on = (e) => setPrefs(e.detail || readRiderPrefs());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [prefs, (patch) => setPrefs(saveRiderPrefs(patch))];
}

/** Directions to a stop in the rider's chosen app (exact pin, else the written address). */
export const directionsUrl = (navApp, point, address = '') => {
  const hasPoint = point?.lat != null && point?.lng != null;
  if (navApp === 'waze') {
    return hasPoint ? `https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  }
  const dest = hasPoint ? `${point.lat},${point.lng}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
};
