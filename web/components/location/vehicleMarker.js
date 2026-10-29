/**
 * Yango-style rider marker: a top-down vehicle icon that turns to face where it
 * is going and glides between GPS fixes instead of jumping.
 *
 *   const v = createVehicleMarker(maplibregl, { vehicle: 'motorcycle', color: '#2563eb' }).addTo(map);
 *   v.moveTo({ lat, lng });   // animates and rotates
 *   v.setColor('#d97706'); v.remove();
 */

// Top-down silhouettes, nose pointing up (north) in a 40×40 box.
const SHAPES = {
  motorcycle: `
    <rect x="17.5" y="5" width="5" height="7" rx="2.5" fill="#1f2937"/>
    <rect x="17.5" y="28" width="5" height="7" rx="2.5" fill="#1f2937"/>
    <path d="M20 8 C25 10 26 14 25.5 20 L25 29 Q20 32 15 29 L14.5 20 C14 14 15 10 20 8 Z" fill="currentColor"/>
    <rect x="11" y="12" width="18" height="3" rx="1.5" fill="#1f2937"/>
    <circle cx="20" cy="21" r="4.2" fill="#fff"/>
    <circle cx="20" cy="21" r="2.8" fill="#1f2937"/>`,
  bicycle: `
    <rect x="18.3" y="4" width="3.4" height="9" rx="1.7" fill="#1f2937"/>
    <rect x="18.3" y="27" width="3.4" height="9" rx="1.7" fill="#1f2937"/>
    <rect x="17" y="11" width="6" height="18" rx="3" fill="currentColor"/>
    <rect x="12" y="11.5" width="16" height="2.6" rx="1.3" fill="#1f2937"/>
    <circle cx="20" cy="20" r="4" fill="#fff"/>
    <circle cx="20" cy="20" r="2.6" fill="#1f2937"/>`,
  car: `
    <rect x="11" y="4" width="18" height="32" rx="6" fill="currentColor"/>
    <path d="M13.5 12.5 Q20 9 26.5 12.5 L25.5 16 Q20 14 14.5 16 Z" fill="#0f172a" opacity=".85"/>
    <path d="M14.5 27 Q20 29 25.5 27 L26.5 30 Q20 32.5 13.5 30 Z" fill="#0f172a" opacity=".7"/>
    <rect x="14" y="17" width="12" height="9" rx="2" fill="#fff" opacity=".18"/>`,
  van: `
    <rect x="10.5" y="3" width="19" height="34" rx="5" fill="currentColor"/>
    <path d="M13 9.5 Q20 6.5 27 9.5 L26 13 Q20 11.5 14 13 Z" fill="#0f172a" opacity=".85"/>
    <rect x="13" y="16" width="14" height="18" rx="2" fill="#fff" opacity=".22"/>`,
  on_foot: `
    <circle cx="20" cy="20" r="8" fill="currentColor"/>
    <circle cx="20" cy="20" r="3.5" fill="#fff"/>
    <path d="M20 5 L24 11 H16 Z" fill="currentColor"/>`,
};

const svgFor = (vehicle) => `<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">${SHAPES[vehicle] || SHAPES.motorcycle}</svg>`;

// Initial compass bearing from a to b, in degrees.
const bearing = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
// Rough metres between two nearby points (enough to ignore GPS jitter).
const metres = (a, b) => Math.hypot((b.lat - a.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

export function createVehicleMarker(maplibregl, { vehicle = 'motorcycle', color = '#2563eb', label = 'Rider', glideMs = 1500 } = {}) {
  const el = document.createElement('div');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  // White disc with a coloured ring keeps the vehicle readable on any map background.
  el.style.cssText = `width:46px;height:46px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box`;
  const body = document.createElement('div');
  body.style.cssText = `width:36px;height:36px;color:${color};transition:transform .6s ease;will-change:transform`;
  body.innerHTML = svgFor(vehicle);
  el.appendChild(body);

  const marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map' });
  let pos = null;
  let heading = 0;
  let frame = null;

  const api = {
    marker,
    element: el,
    addTo(map) { marker.addTo(map); return api; },
    setPopup(popup) { marker.setPopup(popup); return api; },
    setColor(c) { body.style.color = c; el.style.borderColor = c; return api; },
    setVehicle(v) { body.innerHTML = svgFor(v); return api; },
    getLngLat() { return pos; },
    /** Glide to a new fix and face the direction of travel (ignores sub-5 m jitter). */
    moveTo(next) {
      if (!pos) { pos = { ...next }; marker.setLngLat([next.lng, next.lat]); return api; }
      if (metres(pos, next) < 5) return api;
      heading = bearing(pos, next);
      body.style.transform = `rotate(${heading}deg)`;
      const from = { ...pos };
      pos = { ...next };
      if (frame) cancelAnimationFrame(frame);
      const start = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - start) / glideMs);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
        marker.setLngLat([from.lng + (next.lng - from.lng) * e, from.lat + (next.lat - from.lat) * e]);
        frame = k < 1 ? requestAnimationFrame(step) : null;
      };
      frame = requestAnimationFrame(step);
      return api;
    },
    remove() { if (frame) cancelAnimationFrame(frame); marker.remove(); },
  };
  return api;
}
