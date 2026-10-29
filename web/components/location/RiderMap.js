'use client';
/**
 * The rider's own full-screen map: their vehicle (following the phone's GPS), the
 * pickup (dark dot) and drop-off (pink pin) of the delivery they are on, and the
 * road route to the next stop. Hollow stops are only the quartier centre.
 * `recenterKey` changing re-frames the map on the rider. Import through next/dynamic.
 */
import { useEffect, useRef } from 'react';
import maplibregl, { createMap } from '@/lib/maplibre';
import { MAP_STYLE } from './PinMap';
import { createVehicleMarker } from './vehicleMarker';

const YAOUNDE = [11.5021, 3.8480];
const ROUTE = 'aura-rider-route';
const line = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords || [] } });

const dot = (color, size, hollow) => {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${hollow ? color : '#fff'};background:${hollow ? 'rgba(255,255,255,.9)' : color};box-shadow:0 1px 5px rgba(0,0,0,.35)`;
  return el;
};

export default function RiderMap({ me, vehicle = 'motorcycle', job = null, recenterKey = 0, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const meMarker = useRef(null);
  const stops = useRef([]);
  const ready = useRef(false);
  const framedJob = useRef(null);
  const latest = useRef({ me, job });
  latest.current = { me, job };

  useEffect(() => {
    const start = me ? [me.lng, me.lat] : job?.dropoff ? [job.dropoff.lng, job.dropoff.lat] : YAOUNDE;
    const m = createMap({ container: container.current, style: MAP_STYLE, center: start, zoom: me ? 15 : 12.5, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    m.touchZoomRotate.disableRotation();
    // Draw the route as soon as the style is ready ('load' waits for every tile).
    m.once('style.load', () => {
      m.addSource(ROUTE, { type: 'geojson', data: line(latest.current.job?.route?.coordinates) });
      m.addLayer({ id: `${ROUTE}-casing`, type: 'line', source: ROUTE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
      m.addLayer({ id: ROUTE, type: 'line', source: ROUTE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 6 } });
      ready.current = true;
    });
    map.current = m;
    return () => { meMarker.current?.remove(); meMarker.current = null; stops.current.forEach((s) => s.remove()); stops.current = []; ready.current = false; framedJob.current = null; m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The rider's vehicle glides to each new GPS fix.
  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    if (!meMarker.current) meMarker.current = createVehicleMarker(maplibregl, { vehicle, label: 'You' }).moveTo(me).addTo(m);
    else meMarker.current.moveTo(me);
  }, [me?.lat, me?.lng, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stops and route for the current delivery; frame rider + stops once per delivery step.
  const jobKey = job ? `${job.shipment_id}:${job.status}` : null;
  const routeKey = job?.route?.computed_at || null;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => m.getSource(ROUTE)?.setData(line(job?.route?.coordinates));
    if (ready.current) draw(); else m.once('style.load', () => setTimeout(draw, 0));
    stops.current.forEach((s) => s.remove());
    stops.current = [];
    if (!job) return;
    const goingToPickup = job.status === 'assigned';
    if (goingToPickup && job.pickup) stops.current.push(new maplibregl.Marker({ element: dot('#111827', 18, job.pickup.approx) }).setLngLat([job.pickup.lng, job.pickup.lat]).addTo(m));
    if (job.dropoff) stops.current.push(job.dropoff.approx
      ? new maplibregl.Marker({ element: dot('#ff00ff', 20, true) }).setLngLat([job.dropoff.lng, job.dropoff.lat]).addTo(m)
      : new maplibregl.Marker({ color: '#ff00ff' }).setLngLat([job.dropoff.lng, job.dropoff.lat]).addTo(m));
    if (framedJob.current !== jobKey) {
      framedJob.current = jobKey;
      const b = new maplibregl.LngLatBounds();
      if (latest.current.me) b.extend([latest.current.me.lng, latest.current.me.lat]);
      if (goingToPickup && job.pickup) b.extend([job.pickup.lng, job.pickup.lat]);
      if (job.dropoff) b.extend([job.dropoff.lng, job.dropoff.lat]);
      for (const c of job.route?.coordinates || []) b.extend(c);
      const fit = () => { m.resize(); m.fitBounds(b, { padding: { top: 90, bottom: 260, left: 40, right: 40 }, maxZoom: 16, duration: 0 }); };
      if (!b.isEmpty()) { if (m.loaded()) fit(); else m.once('load', fit); }
    }
  }, [jobKey, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || !recenterKey || !latest.current.me) return;
    m.easeTo({ center: [latest.current.me.lng, latest.current.me.lat], zoom: Math.max(m.getZoom(), 15.5), duration: 500 });
  }, [recenterKey]);

  return <div ref={container} className={`size-full ${className}`} role="application" aria-label="Map with your position and your delivery route" />;
}
