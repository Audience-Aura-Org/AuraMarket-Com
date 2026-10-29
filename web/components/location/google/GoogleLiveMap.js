'use client';
/**
 * Google Maps version of LiveMap: the rider's vehicle (turning and gliding between
 * GPS fixes) and the destination pin. Same props as components/location/LiveMap.js.
 */
import { useEffect, useRef } from 'react';
import { loadGoogleMaps, baseMapOptions } from '@/lib/googleMaps';
import { createGoogleVehicleMarker } from '../vehicleMarker';

const destinationElement = () => {
  const el = document.createElement('div');
  el.innerHTML = '<svg width="30" height="40" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.3 17 44 17 44s17-14.7 17-27.2C34 7.5 26.4 0 17 0z" fill="#ff00ff"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>';
  el.style.cssText = 'transform:translateY(4px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))';
  return el;
};

export default function GoogleLiveMap({ rider, destination, route = null, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const vehicle = useRef(null);
  const lib = useRef(null);
  const lines = useRef([]);
  const pickupMarker = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      const { Map, AdvancedMarkerElement, LatLngBounds } = g;
      if (cancelled || !container.current) return;
      lib.current = g;
      const m = new Map(container.current, baseMapOptions({ center: { lat: rider.lat, lng: rider.lng }, zoom: 15 }));
      vehicle.current = createGoogleVehicleMarker(AdvancedMarkerElement, m, { vehicle: rider.vehicle_type, label: 'Rider' }).moveTo(rider);
      if (destination?.lat != null) {
        new AdvancedMarkerElement({ map: m, position: { lat: destination.lat, lng: destination.lng }, content: destinationElement(), title: 'Delivery address' });
        // Show rider and destination together the first time.
        const b = new LatLngBounds();
        b.extend({ lat: rider.lat, lng: rider.lng });
        b.extend({ lat: destination.lat, lng: destination.lng });
        m.fitBounds(b, 50);
      }
      map.current = m;
      drawRoute();
    }).catch(() => {});
    return () => { cancelled = true; vehicle.current?.remove(); vehicle.current = null; map.current = null; };
    // Created once; position updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !vehicle.current) return;
    vehicle.current.moveTo(rider);
    // Follow the rider only if they are about to leave the visible area.
    const bounds = map.current.getBounds();
    if (bounds && !bounds.contains({ lat: rider.lat, lng: rider.lng })) map.current.panTo({ lat: rider.lat, lng: rider.lng });
  }, [rider.lat, rider.lng]);

  // Road route: white casing under a blue line, like navigation apps; the pickup is
  // marked while the rider is still going to collect the package.
  const drawRoute = () => {
    const m = map.current;
    const g = lib.current;
    if (!m || !g) return;
    lines.current.forEach((l) => l.setMap(null));
    lines.current = [];
    if (pickupMarker.current) { pickupMarker.current.map = null; pickupMarker.current = null; }
    const path = (route?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
    if (path.length > 1) {
      lines.current = [
        new g.Polyline({ map: m, path, strokeColor: '#ffffff', strokeWeight: 9, strokeOpacity: 1, zIndex: 1 }),
        new g.Polyline({ map: m, path, strokeColor: '#2563eb', strokeWeight: 5, strokeOpacity: 1, zIndex: 2 }),
      ];
    }
    if (route?.heading_to === 'pickup' && route.pickup) {
      const el = document.createElement('div');
      el.style.cssText = 'width:14px;height:14px;border-radius:9999px;background:#111827;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);transform:translateY(50%)';
      pickupMarker.current = new g.AdvancedMarkerElement({ map: m, position: route.pickup, content: el, title: 'Pickup' });
    }
  };
  const routeKey = route?.computed_at || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawRoute(); }, [routeKey]);

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="img" aria-label="Map showing the rider's current position" />;
}
