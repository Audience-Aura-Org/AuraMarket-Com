export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/uploads/'],
    },
    sitemap: 'https://auradime.com/sitemap.xml',
  };
}
