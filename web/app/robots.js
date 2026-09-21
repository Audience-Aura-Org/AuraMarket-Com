export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/uploads/',
          '/vendor/',
          '/onboarding/',
          '/checkout/',
          '/cart/',
          '/wallet/',
          '/orders/',
          '/order-confirmation/',
          '/settings/',
          '/profile/',
          '/messages/',
          '/chat/',
          '/notifications/',
          '/delivery/',
          '/overtime/',
          '/status/',
          '/offline/',
        ],
      },
    ],
    sitemap: 'https://auradime.com/sitemap.xml',
  };
}
