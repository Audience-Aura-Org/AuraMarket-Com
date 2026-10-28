/**
 * MapLibre v6 starts its tile worker from a file next to its own bundle, which
 * Next.js does not copy, so maps stay blank. Serve the worker from public/ instead
 * (lib/maplibre.js points MapLibre at it). Runs before dev and build.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'public', 'maplibre');
mkdirSync(out, { recursive: true });
copyFileSync(join(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs'), join(out, 'maplibre-gl-worker.mjs'));
