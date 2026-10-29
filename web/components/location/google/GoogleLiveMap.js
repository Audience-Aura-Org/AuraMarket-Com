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

export default function GoogleLiveMap({ rider, destination, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const vehicle = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(({ Map, AdvancedMarkerElement, LatLngBounds }) => {
      if (cancelled || !container.current) return;
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

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="img" aria-label="Map showing the rider's current position" />;
}
