const baseUrl = 'https://auradime.com';
const lastModified = new Date('2026-05-30T00:00:00.000Z');

export const dynamic = 'force-static';

const routes = [
  '',
  '/login',
  '/shop',
  '/stores',
  '/collections',
  '/brands',
  '/logistics',
  '/help',
  '/contact',
  '/privacy',
  '/terms',
];

export default function sitemap() {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.7,
  }));
}
