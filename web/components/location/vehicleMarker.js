/**
 * Yango-style rider marker: a top-down vehicle for the rider's vehicle type, over a
 * pulsing "live" ring. It turns to face where it is going and glides between GPS
 * fixes instead of jumping.
 *
 *   const v = createVehicleMarker(maplibregl, { vehicle: 'motorcycle', color: '#2563eb' }).addTo(map);
 *   v.moveTo({ lat, lng });   // animates and rotates
 *   v.setColor('#d97706'); v.remove();
 */

// Top-down vehicles, nose pointing up (north) in a 48×48 box. The body takes the
// marker colour (currentColor); white and black overlays give it light and shade.
const SHAPES = {
  motorcycle: `
    <ellipse cx="25" cy="26" rx="9" ry="19" fill="#000" opacity=".16"/>
    <rect x="21.5" y="3" width="5" height="10" rx="2.5" fill="#111827"/>
    <rect x="21.5" y="35" width="5" height="10" rx="2.5" fill="#111827"/>
    <path d="M24 9c4.6 1.6 6.4 5.8 6.1 11.5l-.6 14.2c-.1 2-2.6 3.8-5.5 3.8s-5.4-1.8-5.5-3.8l-.6-14.2C17.6 14.8 19.4 10.6 24 9z" fill="currentColor"/>
    <path d="M24 10.5c-2.3 1-3.4 3.4-3.6 6.5l3.6-1.2z" fill="#fff" opacity=".45"/>
    <rect x="13" y="14" width="22" height="3" rx="1.5" fill="#1f2937"/>
    <circle cx="13.5" cy="15.5" r="2" fill="#374151"/><circle cx="34.5" cy="15.5" r="2" fill="#374151"/>
    <ellipse cx="24" cy="26.5" rx="8.5" ry="5.5" fill="#1f2937"/>
    <circle cx="24" cy="23" r="5.2" fill="#fff"/>
    <path d="M19.4 21.2a5.2 5.2 0 0 1 9.2 0z" fill="#0f172a" opacity=".85"/>`,
  bicycle: `
    <ellipse cx="25" cy="26" rx="8" ry="19" fill="#000" opacity=".14"/>
    <rect x="22.6" y="3" width="2.8" height="12" rx="1.4" fill="#111827"/>
    <rect x="22.6" y="33" width="2.8" height="12" rx="1.4" fill="#111827"/>
    <rect x="22" y="12" width="4" height="22" rx="2" fill="currentColor"/>
    <rect x="15" y="13" width="18" height="2.6" rx="1.3" fill="#1f2937"/>
    <ellipse cx="24" cy="26" rx="7.5" ry="5" fill="#1f2937"/>
    <circle cx="24" cy="22.5" r="4.8" fill="currentColor"/>
    <path d="M20 21a4.8 4.8 0 0 1 8 0z" fill="#fff" opacity=".55"/>`,
  car: `
    <rect x="13" y="6" width="24" height="39" rx="9" fill="#000" opacity=".16"/>
    <rect x="12" y="4" width="24" height="40" rx="9" fill="currentColor"/>
    <rect x="12" y="4" width="4" height="40" rx="2" fill="#000" opacity=".12"/>
    <rect x="32" y="4" width="4" height="40" rx="2" fill="#000" opacity=".12"/>
    <rect x="15" y="5.5" width="4" height="2.4" rx="1.2" fill="#fef9c3"/>
    <rect x="29" y="5.5" width="4" height="2.4" rx="1.2" fill="#fef9c3"/>
    <path d="M15 15.5Q24 11 33 15.5L31.5 20.5Q24 18 16.5 20.5Z" fill="#0f172a" opacity=".88"/>
    <rect x="16.5" y="21.5" width="15" height="12" rx="3" fill="#fff" opacity=".22"/>
    <path d="M16.5 35.5Q24 37.5 31.5 35.5L33 39.5Q24 42.5 15 39.5Z" fill="#0f172a" opacity=".75"/>
    <ellipse cx="10.8" cy="17" rx="1.6" ry="1.1" fill="currentColor"/>
    <ellipse cx="37.2" cy="17" rx="1.6" ry="1.1" fill="currentColor"/>`,
  van: `
    <rect x="12.5" y="4" width="25" height="42" rx="6" fill="#000" opacity=".16"/>
    <rect x="11.5" y="2.5" width="25" height="42" rx="6" fill="currentColor"/>
    <rect x="14" y="3.8" width="4" height="2.2" rx="1.1" fill="#fef9c3"/>
    <rect x="30" y="3.8" width="4" height="2.2" rx="1.1" fill="#fef9c3"/>
    <path d="M14.5 10Q24 6.5 33.5 10L32.5 14Q24 12 15.5 14Z" fill="#0f172a" opacity=".88"/>
    <rect x="14.5" y="17" width="19" height="25" rx="2.5" fill="#fff" opacity=".2"/>
    <path d="M18 20v19M24 20v19M30 20v19" stroke="#000" stroke-opacity=".12" stroke-width="1"/>`,
  on_foot: `
    <ellipse cx="25" cy="26" rx="10" ry="8" fill="#000" opacity=".14"/>
    <ellipse cx="24" cy="25" rx="10" ry="6.5" fill="currentColor"/>
    <circle cx="24" cy="24" r="5.5" fill="#1f2937"/>
    <path d="M24 9l5 7h-10z" fill="currentColor"/>`,
};

const svgFor = (vehicle) => `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">${SHAPES[vehicle] || SHAPES.motorcycle}</svg>`;

// "Live" pulse under the rider; the keyframes are injected once per page.
const ensurePulseStyle = () => {
  if (typeof document === 'undefined' || document.getElementById('aura-live-pulse')) return;
  const style = document.createElement('style');
  style.id = 'aura-live-pulse';
  style.textContent = '@keyframes aura-live-pulse{0%{transform:scale(.5);opacity:.6}100%{transform:scale(1.7);opacity:0}}';
  document.head.appendChild(style);
};
const haloColor = (color) => `${color}55`; // the marker colour at ~33% opacity

// Initial compass bearing from a to b, in degrees.
const bearing = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
// Rough metres between two nearby points (enough to ignore GPS jitter).
const metres = (a, b) => Math.hypot((b.lat - a.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

/**
 * Map-agnostic core: the vehicle element plus turning and gliding. `place(pos)`
 * puts the marker at { lat, lng } on whichever map library hosts it.
 */
function vehicleCore({ vehicle = 'motorcycle', color = '#2563eb', label = 'Rider', glideMs = 1500 } = {}, place) {
  ensurePulseStyle();
  const el = document.createElement('div');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.style.cssText = 'position:relative;width:52px;height:52px;cursor:pointer';
  // Pulsing ring: shows at a glance that this position is live.
  const ring = document.createElement('div');
  ring.style.cssText = `position:absolute;inset:6px;border-radius:9999px;background:${haloColor(color)};animation:aura-live-pulse 1.8s ease-out infinite;pointer-events:none`;
  const body = document.createElement('div');
  body.style.cssText = `position:absolute;left:4px;top:4px;width:44px;height:44px;color:${color};transition:transform .6s ease;will-change:transform;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))`;
  body.innerHTML = svgFor(vehicle);
  el.append(ring, body);

  let pos = null;
  let frame = null;
  const core = {
    element: el,
    setColor(c) { body.style.color = c; ring.style.background = haloColor(c); },
    setVehicle(v) { body.innerHTML = svgFor(v); },
    getPosition() { return pos; },
    /** Glide to a new fix and face the direction of travel (ignores sub-5 m jitter). */
    moveTo(next) {
      if (!pos) { pos = { lat: next.lat, lng: next.lng }; place(pos); return; }
      if (metres(pos, next) < 5) return;
      body.style.transform = `rotate(${bearing(pos, next)}deg)`;
      const from = { ...pos };
      pos = { lat: next.lat, lng: next.lng };
      if (frame) cancelAnimationFrame(frame);
      const start = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - start) / glideMs);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
        place({ lat: from.lat + (next.lat - from.lat) * e, lng: from.lng + (next.lng - from.lng) * e });
        frame = k < 1 ? requestAnimationFrame(step) : null;
      };
      frame = requestAnimationFrame(step);
    },
    stop() { if (frame) cancelAnimationFrame(frame); },
  };
  return core;
}

/** MapLibre marker. */
export function createVehicleMarker(maplibregl, options = {}) {
  let marker = null;
  const core = vehicleCore(options, (p) => marker.setLngLat([p.lng, p.lat]));
  marker = new maplibregl.Marker({ element: core.element });
  const api = {
    marker,
    element: core.element,
    addTo(map) { marker.addTo(map); return api; },
    setPopup(popup) { marker.setPopup(popup); return api; },
    setColor(c) { core.setColor(c); return api; },
    setVehicle(v) { core.setVehicle(v); return api; },
    getLngLat() { return core.getPosition(); },
    moveTo(next) { core.moveTo(next); return api; },
    remove() { core.stop(); marker.remove(); },
  };
  return api;
}

/** Google Maps AdvancedMarkerElement (lib/googleMaps.js). */
export function createGoogleVehicleMarker(AdvancedMarkerElement, map, options = {}) {
  let marker = null;
  const core = vehicleCore(options, (p) => { marker.position = p; });
  // Google anchors custom content at its bottom edge: centre the vehicle on the position.
  core.element.style.transform = 'translateY(50%)';
  marker = new AdvancedMarkerElement({ map, content: core.element, title: options.label || 'Rider' });
  const api = {
    marker,
    element: core.element,
    setColor(c) { core.setColor(c); return api; },
    setVehicle(v) { core.setVehicle(v); return api; },
    getPosition() { return core.getPosition(); },
    moveTo(next) { core.moveTo(next); return api; },
    remove() { core.stop(); marker.map = null; },
  };
  return api;
}
