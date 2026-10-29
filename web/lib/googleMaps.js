/**
 * Google Maps JavaScript API, loaded once on demand.
 *
 *   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   browser key (restrict it to auradime.com and the app)
 *   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID    map ID for custom markers (Google Cloud → Map management);
 *                                     DEMO_MAP_ID works for testing
 *
 * Without a key the app keeps using the free MapLibre maps (see components/location/maps.js).
 */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
export const useGoogleMaps = Boolean(GOOGLE_MAPS_KEY);

let loading = null;

/** Resolves to { Map, AdvancedMarkerElement, InfoWindow, LatLngBounds, Polyline } once the API is ready. */
export function loadGoogleMaps() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Google Maps needs a browser'));
    const done = async () => {
      try {
        const [{ Map, InfoWindow, Polyline }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('core'),
        ]);
        resolve({ Map, AdvancedMarkerElement, InfoWindow, LatLngBounds, Polyline });
      } catch (e) { reject(e); }
    };
    if (window.google?.maps?.importLibrary) return done();
    window.__auraGoogleMapsReady = done;
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__auraGoogleMapsReady`;
    s.async = true;
    s.onerror = () => { loading = null; reject(new Error('Google Maps could not load')); };
    document.head.appendChild(s);
  });
  return loading;
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
