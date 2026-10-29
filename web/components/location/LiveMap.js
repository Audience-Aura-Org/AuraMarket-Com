'use client';
/**
 * Read-only map with the rider's live position, the destination when known, and the
 * road route the rider will take (a blue line, with the pickup marked while the
 * rider is still going to collect the package).
 * Import through next/dynamic so MapLibre loads only when a rider is on the move.
 */
import { useEffect, useRef } from 'react';
import maplibregl, { createMap } from '@/lib/maplibre';
import { MAP_STYLE } from './PinMap';
import { createVehicleMarker } from './vehicleMarker';

const ROUTE = 'aura-route';
const routeData = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords || [] } });

export default function LiveMap({ rider, destination, route = null, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pickupMarker = useRef(null);
  const styleReady = useRef(false);
  const latestRoute = useRef(route);
  latestRoute.current = route;

  useEffect(() => {
    const m = createMap({
      container: container.current,
      style: MAP_STYLE,
      center: [rider.lng, rider.lat],
      zoom: 15,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // The rider's vehicle, turning to face the road and gliding between GPS fixes.
    marker.current = createVehicleMarker(maplibregl, { vehicle: rider.vehicle_type, label: 'Rider' }).moveTo(rider).addTo(m);
    if (destination?.lat != null) {
      new maplibregl.Marker({ color: '#ff00ff' }).setLngLat([destination.lng, destination.lat]).addTo(m);
      // Show rider and destination together the first time.
      m.fitBounds([[Math.min(rider.lng, destination.lng), Math.min(rider.lat, destination.lat)], [Math.max(rider.lng, destination.lng), Math.max(rider.lat, destination.lat)]], { padding: 50, maxZoom: 16, duration: 0 });
    }
    // Route line under the markers: white casing with a blue line, like navigation apps.
    m.on('load', () => {
      m.addSource(ROUTE, { type: 'geojson', data: routeData(latestRoute.current?.coordinates) });
      m.addLayer({ id: `${ROUTE}-casing`, type: 'line', source: ROUTE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } });
      m.addLayer({ id: ROUTE, type: 'line', source: ROUTE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 5 } });
      styleReady.current = true;
    });
    map.current = m;
    return () => { marker.current?.remove(); pickupMarker.current?.remove(); m.remove(); map.current = null; marker.current = null; styleReady.current = false; };
    // Created once; position updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.moveTo(rider);
    // Follow the rider only if they are about to leave the visible area.
    if (!map.current.getBounds().contains([rider.lng, rider.lat])) map.current.easeTo({ center: [rider.lng, rider.lat], duration: 600 });
  }, [rider.lat, rider.lng]);

  // Redraw the route when the server sends a new one (it recomputes as the rider moves).
  const routeKey = route?.computed_at || null;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (styleReady.current) m.getSource(ROUTE)?.setData(routeData(route?.coordinates));
    pickupMarker.current?.remove();
    pickupMarker.current = null;
    if (route?.heading_to === 'pickup' && route.pickup) {
      pickupMarker.current = new maplibregl.Marker({ color: '#111827', scale: 0.8 }).setLngLat([route.pickup.lng, route.pickup.lat]).addTo(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="img" aria-label="Map showing the rider's current position" />;
}
