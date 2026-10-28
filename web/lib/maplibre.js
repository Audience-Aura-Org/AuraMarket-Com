/**
 * The one place that imports MapLibre: points it at the worker served from
 * public/maplibre (copied by scripts/copy-maplibre-worker.mjs), since Next.js does
 * not bundle the worker file MapLibre looks for next to itself.
 */
import * as maplibregl from 'maplibre-gl'; // v6 is ESM-only with named exports
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export default maplibregl;
