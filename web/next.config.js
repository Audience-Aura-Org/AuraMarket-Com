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
  turbopack: {
    root: __dirname,
  },
  ...(!isCapacitorBuild
    ? {
        // Aggressive static asset caching. Not emitted by static export builds.
        async headers() {
          return [
            {
              source: '/_next/static/:path*',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
              ],
            },
            {
              source: '/uploads/:path*',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
              ],
            },
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

