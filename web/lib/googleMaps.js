/**
 * Google Maps JavaScript API, loaded once on demand.
 *
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   browser key (restrict it to auradime.com and the app)
 *   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID    map ID for custom markers (Google Cloud → Map management);
 *                                     DEMO_MAP_ID works for testing
 *
 * Without a key the app keeps using the free MapLibre maps. With a key Google refuses
 * (API not enabled, billing off, domain not allowed) every map switches to the free
 * one too, and stays on it for the rest of the session (components/location/withMapFallback.js).
 */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
export const useGoogleMaps = Boolean(GOOGLE_MAPS_KEY);

let loading = null;

// Google refused the key or failed to load: remember it for this session.
const FAILED_KEY = 'aura-gmaps-failed';
const listeners = new Set();
let failed = (() => { try { return typeof window !== 'undefined' && sessionStorage.getItem(FAILED_KEY) === '1'; } catch { return false; } })();
export const googleMapsFailed = () => failed;
export const onGoogleMapsFailure = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const markFailed = (why) => {
  if (failed) return;
  failed = true;
  console.warn('[maps] Google Maps unavailable, using the free map:', why);
  try { sessionStorage.setItem(FAILED_KEY, '1'); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
};

/** Resolves to { Map, AdvancedMarkerElement, InfoWindow, LatLngBounds, Polyline } once the API is ready. */
export function loadGoogleMaps() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Google Maps needs a browser'));
    if (failed) return reject(new Error('Google Maps unavailable'));
    // Google calls this when the key is refused (API not enabled, billing, referrer).
    window.gm_authFailure = () => markFailed('key refused');
    const done = async () => {
      try {
        const [{ Map, InfoWindow, Polyline }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('core'),
        ]);
        resolve({ Map, AdvancedMarkerElement, InfoWindow, LatLngBounds, Polyline });
      } catch (e) { markFailed(e.message); reject(e); }
    };
    if (window.google?.maps?.importLibrary) return done();
    // A script that never answers (blocked network, captive portal) must not leave a blank map.
    const timeout = setTimeout(() => { loading = null; markFailed('no answer in 15 s'); reject(new Error('Google Maps did not load')); }, 15000);
    window.__auraGoogleMapsReady = () => { clearTimeout(timeout); done(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__auraGoogleMapsReady`;
    s.async = true;
    s.onerror = () => { loading = null; markFailed('script did not load'); reject(new Error('Google Maps could not load')); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Google signals billing problems (and some key problems) not through
 * gm_authFailure but by dimming the map with "For development purposes only" and a
 * "can't load Google Maps correctly" box. Watch a new map's container for that and
 * switch every map to the free one. Returns a function that stops watching.
 */
export function guardGoogleMap(container) {
  if (!container || typeof MutationObserver === 'undefined') return () => {};
  const broken = () => /can.t load Google Maps correctly|For development purposes only/i.test(container.textContent || '');
  const check = () => { if (broken()) { markFailed('Google map error (billing or key)'); stop(); } };
  const observer = new MutationObserver(check);
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  const timer = setTimeout(() => stop(), 20000); // the error shows within seconds of loading
  function stop() { observer.disconnect(); clearTimeout(timer); }
  check();
  return stop;
}

/** Map options shared by every Auradime map: app-like gestures, minimal controls. */
export const baseMapOptions = (extra = {}) => ({
  mapId: GOOGLE_MAP_ID,
  gestureHandling: 'greedy', // one finger pans, like the Google Maps app
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  ...extra,
});
