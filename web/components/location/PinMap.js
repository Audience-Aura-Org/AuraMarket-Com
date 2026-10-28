'use client';
/**
 * MapLibre map with one draggable pin (OpenFreeMap tiles: free, no API key).
 * Import this through next/dynamic so the ~250 kB map library loads only when a
 * map is actually shown.
 */
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl'; // v6 is ESM-only with named exports
import 'maplibre-gl/dist/maplibre-gl.css';

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DOUALA = { lat: 4.0511, lng: 9.7043 };

export default function PinMap({ pin, center, zoom = 15, onPinChange, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChange = useRef(onPinChange);
  onChange.current = onPinChange;

  useEffect(() => {
    const start = pin || center || DOUALA;
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: pin ? zoom : 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const mk = new maplibregl.Marker({ color: '#ff00ff', draggable: true }).setLngLat([start.lng, start.lat]).addTo(m);
    mk.on('dragend', () => { const { lng, lat } = mk.getLngLat(); onChange.current?.({ lat, lng }); });
    // Tapping the map moves the pin there: easier than dragging on a phone.
    m.on('click', (e) => { mk.setLngLat(e.lngLat); onChange.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    map.current = m;
    marker.current = mk;
    return () => { m.remove(); map.current = null; marker.current = null; };
    // The map is created once; position updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pin || !map.current || !marker.current) return;
    const current = marker.current.getLngLat();
    if (Math.abs(current.lat - pin.lat) < 1e-7 && Math.abs(current.lng - pin.lng) < 1e-7) return;
    marker.current.setLngLat([pin.lng, pin.lat]);
    map.current.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.current.getZoom(), zoom), duration: 400 });
  }, [pin, zoom]);

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="application" aria-label="Map: tap or drag the pin to the exact spot" />;
}
