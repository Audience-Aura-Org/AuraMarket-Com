'use client';
/**
 * Admin live map: riders as vehicle icons (blue = free, amber = on a delivery) that
 * turn and glide between refreshes, each busy rider's road route to their pickup or
 * drop-off, and deliveries under
 * way (dark dot = pickup, pink pin = drop-off; hollow when the point is only the
 * quartier centre). Import through next/dynamic: MapLibre loads only here.
 */
import { useEffect, useRef } from 'react';
import maplibregl, { createMap } from '@/lib/maplibre';
import { MAP_STYLE } from './PinMap';
import { createVehicleMarker } from './vehicleMarker';

const DOUALA = [9.7043, 4.0511];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dot = (color, size, hollow = false) => {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${hollow ? color : '#fff'};background:${hollow ? 'rgba(255,255,255,.85)' : color};box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer`;
  return el;
};

const ROUTES = 'aura-fleet-routes';
// One line per busy rider, in the rider's status colour.
const routeLines = (riders) => ({
  type: 'FeatureCollection',
  features: riders.filter((r) => r.job?.route?.coordinates?.length > 1).map((r) => ({
    type: 'Feature', properties: { color: r.availability === 'busy' ? '#d97706' : '#2563eb' },
    geometry: { type: 'LineString', coordinates: r.job.route.coordinates },
  })),
});

export default function FleetMap({ riders = [], deliveries = [], className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef([]); // delivery points, redrawn on each refresh
  const riderMarkers = useRef(new Map()); // one per rider, kept so it can glide
  const fitted = useRef(false);
  const styleReady = useRef(false);
  const latestRiders = useRef(riders);
  latestRiders.current = riders;

  useEffect(() => {
    const m = createMap({ container: container.current, style: MAP_STYLE, center: DOUALA, zoom: 11.5, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource(ROUTES, { type: 'geojson', data: routeLines(latestRiders.current) });
      m.addLayer({ id: `${ROUTES}-casing`, type: 'line', source: ROUTES, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7 } });
      m.addLayer({ id: ROUTES, type: 'line', source: ROUTES, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 } });
      styleReady.current = true;
    });
    map.current = m;
    // A new map (e.g. React mounting twice in development) must be framed again.
    return () => { fitted.current = false; styleReady.current = false; riderMarkers.current.forEach((v) => v.remove()); riderMarkers.current.clear(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const add = (el, lng, lat, html) => {
      const mk = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(html)).addTo(m);
      markers.current.push(mk);
    };
    const bounds = new maplibregl.LngLatBounds();
    for (const d of deliveries) {
      const label = `<strong>${esc(d.tracking_code)}</strong><br>${esc(d.status.replace(/_/g, ' '))}${d.agency ? ` · ${esc(d.agency)}` : ''}<br>${d.has_rider ? 'Rider assigned' : 'Waiting for a rider'}`;
      if (d.pickup) { add(dot('#111827', 12, d.pickup.approx), d.pickup.lng, d.pickup.lat, `Pickup${d.pickup.quartier ? ` · ${esc(d.pickup.quartier)}` : ''}<br>${label}`); bounds.extend([d.pickup.lng, d.pickup.lat]); }
      if (d.dropoff) { add(dot('#ff00ff', 14, d.dropoff.approx), d.dropoff.lng, d.dropoff.lat, `Drop-off${d.dropoff.quartier ? ` · ${esc(d.dropoff.quartier)}` : ''}<br>${label}`); bounds.extend([d.dropoff.lng, d.dropoff.lat]); }
    }
    if (styleReady.current) m.getSource(ROUTES)?.setData(routeLines(riders));
    const seen = new Set();
    for (const r of riders) {
      const id = String(r.rider_id);
      seen.add(id);
      const color = r.availability === 'busy' ? '#d97706' : '#2563eb';
      let v = riderMarkers.current.get(id);
      if (!v) {
        v = createVehicleMarker(maplibregl, { vehicle: r.vehicle_type, color, label: r.name }).moveTo(r).addTo(m);
        riderMarkers.current.set(id, v);
      } else {
        v.setColor(color).moveTo(r);
      }
      v.setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(`<strong>${esc(r.name)}</strong><br>${esc(r.agency || '')}<br>${r.availability === 'busy' ? 'On a delivery' : 'Free'} · ${esc(r.vehicle_type?.replace('_', ' '))}${r.job ? `<br><strong>${esc(r.job.tracking_code)}</strong> · ${r.job.route ? `${r.job.route.heading_to === 'pickup' ? 'to pickup' : 'to drop-off'} in ${r.job.route.eta_min} min (${r.job.route.distance_km} km)` : esc(r.job.status.replace(/_/g, ' '))}` : ''}`));
      bounds.extend([r.lng, r.lat]);
      for (const c of r.job?.route?.coordinates || []) bounds.extend(c);
    }
    // Riders who went offline or lost signal leave the map.
    for (const [id, v] of riderMarkers.current) if (!seen.has(id)) { v.remove(); riderMarkers.current.delete(id); }
    // Frame everything once; later refreshes keep the admin's own view.
    if (!fitted.current && !bounds.isEmpty()) {
      fitted.current = true;
      // Before the map has loaded it does not know its size and ignores fitBounds.
      const fit = () => { m.resize(); m.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 }); };
      if (m.loaded()) fit(); else m.once('load', fit);
    }
  }, [riders, deliveries]);

  return <div ref={container} className={`h-[60vh] min-h-[360px] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] ${className}`} role="application" aria-label="Map of riders and deliveries" />;
}
