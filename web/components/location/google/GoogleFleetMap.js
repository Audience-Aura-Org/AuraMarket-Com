'use client';
/**
 * Google Maps version of FleetMap (admin live map): riders as vehicle icons that
 * turn and glide between refreshes, and deliveries under way (dark dot = pickup,
 * pink dot = drop-off, hollow when only the quartier centre is known).
 * Same props as components/location/FleetMap.js.
 */
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, baseMapOptions } from '@/lib/googleMaps';
import { createGoogleVehicleMarker } from '../vehicleMarker';

const DOUALA = { lat: 4.0511, lng: 9.7043 };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dot = (color, size, hollow = false) => {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${hollow ? color : '#fff'};background:${hollow ? 'rgba(255,255,255,.85)' : color};box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;transform:translateY(50%)`;
  return el;
};

export default function GoogleFleetMap({ riders = [], deliveries = [], className = '' }) {
  const container = useRef(null);
  const lib = useRef(null);
  const map = useRef(null);
  const info = useRef(null);
  const points = useRef([]);
  const riderMarkers = useRef(new Map());
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !container.current) return;
      lib.current = g;
      map.current = new g.Map(container.current, baseMapOptions({ center: DOUALA, zoom: 12 }));
      info.current = new g.InfoWindow();
      setReady(true);
    }).catch(() => {});
    return () => {
      cancelled = true;
      riderMarkers.current.forEach((v) => v.remove());
      riderMarkers.current.clear();
      points.current.forEach((p) => { p.map = null; });
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { AdvancedMarkerElement, LatLngBounds } = lib.current;
    const m = map.current;
    const open = (marker, html) => marker.addListener('click', () => { info.current.setContent(`<div style="font:13px/1.45 sans-serif">${html}</div>`); info.current.open({ map: m, anchor: marker }); });

    points.current.forEach((p) => { p.map = null; });
    points.current = [];
    const bounds = new LatLngBounds();
    for (const d of deliveries) {
      const label = `<strong>${esc(d.tracking_code)}</strong><br>${esc(d.status.replace(/_/g, ' '))}${d.agency ? ` · ${esc(d.agency)}` : ''}<br>${d.has_rider ? 'Rider assigned' : 'Waiting for a rider'}`;
      for (const [pt, color, size, name] of [[d.pickup, '#111827', 12, 'Pickup'], [d.dropoff, '#ff00ff', 14, 'Drop-off']]) {
        if (!pt) continue;
        const mk = new AdvancedMarkerElement({ map: m, position: { lat: pt.lat, lng: pt.lng }, content: dot(color, size, pt.approx), title: name });
        open(mk, `${name}${pt.quartier ? ` · ${esc(pt.quartier)}` : ''}<br>${label}`);
        points.current.push(mk);
        bounds.extend({ lat: pt.lat, lng: pt.lng });
      }
    }
    const seen = new Set();
    for (const r of riders) {
      const id = String(r.rider_id);
      seen.add(id);
      const color = r.availability === 'busy' ? '#d97706' : '#2563eb';
      let v = riderMarkers.current.get(id);
      if (!v) {
        v = createGoogleVehicleMarker(AdvancedMarkerElement, m, { vehicle: r.vehicle_type, color, label: r.name }).moveTo(r);
        open(v.marker, `<strong>${esc(r.name)}</strong><br>${esc(r.agency || '')}<br>${r.availability === 'busy' ? 'On a delivery' : 'Free'} · ${esc(r.vehicle_type?.replace('_', ' '))}`);
        riderMarkers.current.set(id, v);
      } else {
        v.setColor(color).moveTo(r);
      }
      bounds.extend({ lat: r.lat, lng: r.lng });
    }
    // Riders who went offline or lost signal leave the map.
    for (const [id, v] of riderMarkers.current) if (!seen.has(id)) { v.remove(); riderMarkers.current.delete(id); }
    // Frame everything once; later refreshes keep the admin's own view.
    if (!fitted.current && !bounds.isEmpty()) { fitted.current = true; m.fitBounds(bounds, 60); }
  }, [ready, riders, deliveries]);

  return <div ref={container} className={`h-[60vh] min-h-[360px] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] ${className}`} role="application" aria-label="Map of riders and deliveries" />;
}
