'use client';
/**
 * Google Maps version of PinMap: one draggable pin; tapping the map moves it there.
 * Same props as components/location/PinMap.js.
 */
import { useEffect, useRef } from 'react';
import { loadGoogleMaps, baseMapOptions } from '@/lib/googleMaps';

const DOUALA = { lat: 4.0511, lng: 9.7043 };

const pinElement = () => {
  const el = document.createElement('div');
  el.innerHTML = '<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.3 17 44 17 44s17-14.7 17-27.2C34 7.5 26.4 0 17 0z" fill="#ff00ff"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>';
  el.style.cssText = 'transform:translateY(4px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));cursor:grab';
  return el;
};

export default function GooglePinMap({ pin, center, zoom = 16, onPinChange, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChange = useRef(onPinChange);
  onChange.current = onPinChange;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(({ Map, AdvancedMarkerElement }) => {
      if (cancelled || !container.current) return;
      const start = pin || center || DOUALA;
      const m = new Map(container.current, baseMapOptions({ center: start, zoom: pin ? zoom : 13 }));
      const mk = new AdvancedMarkerElement({ map: m, position: start, content: pinElement(), gmpDraggable: true, title: 'Delivery spot' });
      // position may be a LatLng (methods) or a plain { lat, lng }.
      const read = (p) => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng });
      mk.addListener('dragend', () => onChange.current?.(read(mk.position)));
      // Tapping the map moves the pin there: easier than dragging on a phone.
      m.addListener('click', (e) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        mk.position = p;
        onChange.current?.(p);
      });
      map.current = m;
      marker.current = mk;
    }).catch(() => {});
    return () => { cancelled = true; if (marker.current) marker.current.map = null; map.current = null; marker.current = null; };
    // The map is created once; position updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pin || !map.current || !marker.current) return;
    const cur = marker.current.position;
    const lat = typeof cur?.lat === 'function' ? cur.lat() : cur?.lat;
    const lng = typeof cur?.lng === 'function' ? cur.lng() : cur?.lng;
    if (Math.abs((lat ?? 0) - pin.lat) < 1e-7 && Math.abs((lng ?? 0) - pin.lng) < 1e-7) return;
    marker.current.position = pin;
    map.current.panTo(pin);
    if (map.current.getZoom() < zoom) map.current.setZoom(zoom);
  }, [pin, zoom]);

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="application" aria-label="Map: tap or drag the pin to the exact spot" />;
}
