'use client';
/**
 * Google Maps version of FleetMap (admin live map): riders as vehicle icons that
 * turn and glide between refreshes, and deliveries under way (dark dot = pickup,
 * pink dot = drop-off, hollow when only the quartier centre is known).
 * Same props as components/location/FleetMap.js.
 */
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, baseMapOptions, guardGoogleMap } from '@/lib/googleMaps';
import { createGoogleVehicleMarker } from '../vehicleMarker';

const DOUALA = { lat: 4.0511, lng: 9.7043 };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dot = (color, size, hollow = false) => {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${hollow ? color : '#fff'};background:${hollow ? 'rgba(255,255,255,.85)' : color};box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;transform:translateY(50%)`;
  return el;
};

export default function GoogleFleetMap({ riders = [], deliveries = [], className = '', height = 'h-[60vh] min-h-[360px]' }) {
  const container = useRef(null);
  const lib = useRef(null);
  const map = useRef(null);
  const info = useRef(null);
  const points = useRef([]);
  const riderMarkers = useRef(new Map());
  const routeLinesRef = useRef([]);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !container.current) return;
      lib.current = g;
      map.current = new g.Map(container.current, baseMapOptions({ center: DOUALA, zoom: 12 }));
      guardGoogleMap(container.current); // billing/key errors → free map
      info.current = new g.InfoWindow();
      setReady(true);
    }).catch(() => {});
    return () => {
      cancelled = true;
      fitted.current = false; // a new map must be framed again
      riderMarkers.current.forEach((v) => v.remove());
      riderMarkers.current.clear();
      points.current.forEach((p) => { p.map = null; });
      routeLinesRef.current.forEach((l) => l.setMap(null));
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
    // Each busy rider's road route: white casing under a line in the rider's colour.
    routeLinesRef.current.forEach((l) => l.setMap(null));
    routeLinesRef.current = [];
    for (const r of riders) {
      const path = (r.job?.route?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
      if (path.length < 2) continue;
      const color = r.availability === 'busy' ? '#d97706' : '#2563eb';
      routeLinesRef.current.push(
        new lib.current.Polyline({ map: m, path, strokeColor: '#ffffff', strokeWeight: 7, zIndex: 1 }),
        new lib.current.Polyline({ map: m, path, strokeColor: color, strokeWeight: 4, strokeOpacity: 0.9, zIndex: 2 }),
      );
      path.forEach((pt) => bounds.extend(pt));
    }
    const seen = new Set();
    for (const r of riders) {
      const id = String(r.rider_id);
      seen.add(id);
      const color = r.availability === 'busy' ? '#d97706' : '#2563eb';
      let v = riderMarkers.current.get(id);
      if (!v) {
        v = createGoogleVehicleMarker(AdvancedMarkerElement, m, { vehicle: r.vehicle_type, color, label: r.name }).moveTo(r);
        open(v.marker, `<strong>${esc(r.name)}</strong><br>${esc(r.agency || '')}<br>${r.availability === 'busy' ? 'On a delivery' : 'Free'} · ${esc(r.vehicle_type?.replace('_', ' '))}${r.job ? `<br><strong>${esc(r.job.tracking_code)}</strong> · ${r.job.route ? `${r.job.route.heading_to === 'pickup' ? 'to pickup' : 'to drop-off'} in ${r.job.route.eta_min} min (${r.job.route.distance_km} km)` : esc(r.job.status.replace(/_/g, ' '))}` : ''}`);
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

  return <div ref={container} className={`${height} w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] ${className}`} role="application" aria-label="Map of riders and deliveries" />;
}
