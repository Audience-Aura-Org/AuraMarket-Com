import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isCapacitorBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h image cache
    ...(isCapacitorBuild ? { unoptimized: true } : {}),
  },
  compress: true,
  poweredByHeader: false,
  ...(!isCapacitorBuild ? {
    turbopack: {
      root: __dirname,
    },
  } : {}),
  ...(!isCapacitorBuild
    ? {
        // Aggressive static asset caching. Not emitted by static export builds.
        async headers() {
          return [
            // ── Immutable static bundles (content-hashed filenames) ──────────
            {
              source: '/_next/static/:path*',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
              ],
            },

            // ── Service worker — MUST NOT be cached by browser or CDN ────────
            // Browsers check for a new sw.js on every navigation; a cached copy
            // means users never receive PWA or push-notification updates.
            {
              source: '/sw.js',
              headers: [
                { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
                { key: 'Service-Worker-Allowed', value: '/' },
              ],
            },

            // ── PWA manifest — short TTL so name/icon changes propagate fast ─
            {
              source: '/manifest.json',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=3600' },
              ],
            },

            // ── App icons — moderate cache (filename stays the same) ─────────
            {
              source: '/icon-:size.png',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
              ],
            },
            {
              source: '/apple-touch-icon.png',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
              ],
            },

            // ── User-uploaded content ────────────────────────────────────────
            {
              source: '/uploads/:path*',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
              ],
            },

            // ── APK downloads — never cache; always serve the latest build ───
            {
              source: '/downloads/:path*',
              headers: [
                { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
              ],
            },

            // ── API routes — never cached by browser or CDN ──────────────────
            {
              source: '/api/:path*',
              headers: [
                { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
              ],
            },

            // ── Security headers for all routes ──────────────────────────────
            {
              source: '/:path*',
              headers: [
                { key: 'X-DNS-Prefetch-Control', value: 'on' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
              ],
            },
          ];
        },
        async redirects() {
          return [
            {
              source: '/auth/login',
              destination: '/login',
              permanent: true,
            },
            {
              source: '/auth/register',
              destination: '/register',
              permanent: true,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;

