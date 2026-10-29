/**
 * The one place that imports MapLibre: points it at the worker served from
 * public/maplibre (copied by scripts/copy-maplibre-worker.mjs), since Next.js does
 * not bundle the worker file MapLibre looks for next to itself.
 */
import * as maplibregl from 'maplibre-gl'; // v6 is ESM-only with named exports
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

/*
 * Ride-hailing style look over OpenFreeMap "liberty" (in the spirit of Yango):
 * light warm base, white streets, yellow main roads, soft buildings from
 * neighbourhood zoom, and landmarks, shops and services from district zoom,
 * so the map stays detailed while riders and pins stand out. Layers missing
 * from the style are skipped.
 */
const PAINT = {
  background: { 'background-color': '#f2efe9' },
  landuse_residential: { 'fill-opacity': 0 },
  park: { 'fill-color': '#d9ecc6', 'fill-opacity': 0.9 },
  landcover_grass: { 'fill-color': '#e1efcf' },
  landcover_wood: { 'fill-color': '#d3e8bf' },
  water: { 'fill-color': '#aed3f2' },
  landuse_hospital: { 'fill-color': '#f6e3e3' },
  landuse_school: { 'fill-color': '#f3ecd9' },
  building: {
    'fill-color': '#e3dfd8',
    'fill-outline-color': '#d9d4cc',
    'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.9],
  },
  road_minor: { 'line-color': '#ffffff' },
  road_service_track: { 'line-color': '#ffffff' },
  road_link: { 'line-color': '#ffffff' },
  road_secondary_tertiary: { 'line-color': '#ffffff' },
  road_minor_casing: { 'line-color': '#dcd7cf' },
  road_service_track_casing: { 'line-color': '#dcd7cf' },
  road_link_casing: { 'line-color': '#dcd7cf' },
  road_secondary_tertiary_casing: { 'line-color': '#d6d0c6' },
  road_trunk_primary: { 'line-color': '#fbd760' },
  road_trunk_primary_casing: { 'line-color': '#e7bd47' },
  road_motorway: { 'line-color': '#f7c948' },
  road_motorway_casing: { 'line-color': '#dca934' },
  bridge_street: { 'line-color': '#ffffff' },
  bridge_secondary_tertiary: { 'line-color': '#ffffff' },
  bridge_trunk_primary: { 'line-color': '#fbd760' },
  bridge_motorway: { 'line-color': '#f7c948' },
};
const HIDE = ['building-3d', 'road_area_pattern', 'road_one_way_arrow', 'road_one_way_arrow_opposite'];
// Points of interest: the most important from district zoom, the rest closer in.
const ZOOM_FROM = { poi_r1: 13.5, poi_transit: 14, poi_r7: 15, poi_r20: 16 };

export function applyCleanStyle(map) {
  const has = (id) => Boolean(map.getLayer(id));
  for (const [id, paint] of Object.entries(PAINT)) {
    if (!has(id)) continue;
    for (const [prop, value] of Object.entries(paint)) {
      try { map.setPaintProperty(id, prop, value); } catch { /* property not on this layer */ }
    }
  }
  for (const id of HIDE) if (has(id)) map.setLayoutProperty(id, 'visibility', 'none');
  for (const [id, minzoom] of Object.entries(ZOOM_FROM)) if (has(id)) map.setLayerZoomRange(id, minzoom, 24);
}

/** new maplibregl.Map(...) with the clean look applied once the style has loaded. */
export function createMap(options) {
  const map = new maplibregl.Map({
    // Phones with 3x screens draw ~2x fewer pixels at 2x, which keeps panning
    // smooth with no visible loss; more cached tiles make returning views instant.
    pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    maxTileCacheSize: 400,
    fadeDuration: 150,
    ...options,
  });
  map.once('style.load', () => applyCleanStyle(map));
  return map;
}

export default maplibregl;
