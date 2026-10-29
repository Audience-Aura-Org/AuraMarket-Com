'use client';
/**
 * Read-only map with the rider's live position (and the destination when known).
 * Import through next/dynamic so MapLibre loads only when a rider is on the move.
 */
import { useEffect, useRef } from 'react';
import maplibregl from '@/lib/maplibre';
import { MAP_STYLE } from './PinMap';
import { createVehicleMarker } from './vehicleMarker';

export default function LiveMap({ rider, destination, className = '' }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  useEffect(() => {
    const m = new maplibregl.Map({
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
    map.current = m;
    return () => { marker.current?.remove(); m.remove(); map.current = null; marker.current = null; };
    // Created once; position updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.moveTo(rider);
    // Follow the rider only if they are about to leave the visible area.
    if (!map.current.getBounds().contains([rider.lng, rider.lat])) map.current.easeTo({ center: [rider.lng, rider.lat], duration: 600 });
  }, [rider.lat, rider.lng]);

  return <div ref={container} className={`h-56 w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] sm:h-64 ${className}`} role="img" aria-label="Map showing the rider's current position" />;
}
