import '../styles/globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  metadataBase: new URL('https://auradime.com'),
  title: {
    default: 'Auradime — Shop, Dine & Deliver Across Cameroon',
    template: '%s | Auradime',
  },
  description: 'Auradime is Cameroon\'s trusted marketplace for shopping, dining, and delivery. Buy quality products, order meals from local restaurants, and enjoy fast logistics — all in one platform.',
  keywords: ['Auradime', 'Cameroon marketplace', 'online shopping Cameroon', 'buy online Cameroon', 'food delivery Cameroon', 'African marketplace', 'Douala shopping', 'Yaoundé shopping', 'Cameroon ecommerce', 'order food online Cameroon', 'local restaurants Cameroon', 'delivery service Cameroon'],
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'fr-CM': '/',
    },
  },
  openGraph: {
    title: 'Auradime — Shop, Dine & Deliver Across Cameroon',
    description: 'Buy quality products, order meals from local restaurants, and enjoy fast delivery — Cameroon\'s trusted all-in-one marketplace.',
    url: 'https://auradime.com',
    siteName: 'Auradime',
    images: [
      { url: '/icon-512.png?v=8', width: 512, height: 512, alt: 'Auradime — Cameroon marketplace for shopping, dining and delivery' },
    ],
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auradime — Shop, Dine & Deliver Across Cameroon',
    description: 'Buy quality products, order meals from local restaurants, and enjoy fast delivery — Cameroon\'s trusted all-in-one marketplace.',
    images: ['/icon-512.png?v=8'],
  },
  appleWebApp: {
    title: 'Auradime',
    statusBarStyle: 'black-translucent',
    capable: true,
  },
  icons: {
    icon: [
      { url: '/icon-192.png?v=8', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=8', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=8', sizes: '512x512', type: 'image/png' },
    ],
  },
  other: {
    'google-site-verification': '',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Auradime',
  url: 'https://auradime.com',
  logo: 'https://auradime.com/icon-512.png',
  description: 'Cameroon\'s trusted marketplace for shopping, dining, and delivery.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hello@auradime.com',
    contactType: 'customer service',
    availableLanguage: ['English', 'French'],
  },
  areaServed: {
    '@type': 'Country',
    name: 'Cameroon',
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Auradime',
  url: 'https://auradime.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://auradime.com/shop?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

const siteNavJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: [
    { '@type': 'SiteNavigationElement', position: 1, name: 'Shop', url: 'https://auradime.com/shop' },
    { '@type': 'SiteNavigationElement', position: 2, name: 'Restaurants', url: 'https://auradime.com/dine' },
    { '@type': 'SiteNavigationElement', position: 3, name: 'Stores', url: 'https://auradime.com/stores' },
    { '@type': 'SiteNavigationElement', position: 4, name: 'Discover', url: 'https://auradime.com/collections' },
    { '@type': 'SiteNavigationElement', position: 5, name: 'Brands', url: 'https://auradime.com/brands' },
    { '@type': 'SiteNavigationElement', position: 6, name: 'Help Center', url: 'https://auradime.com/help-center' },
    { '@type': 'SiteNavigationElement', position: 7, name: 'Sign In', url: 'https://auradime.com/login' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" data-font-size="md" data-font="default">
      <head>
        {/* Viewport: resizes chat content when the virtual keyboard opens in PWA/WebView */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content="#0a050a" />
        {/* Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavJsonLd) }} />
        {/* Dynamic Theme-Aware Favicons */}
        <link rel="icon" href="/icon-192.png?v=8" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/icon-512.png?v=8" media="(prefers-color-scheme: dark)" />
        {/* Fallback for browsers that don't support media queries on icons */}
        <link rel="shortcut icon" href="/icon-512.png?v=8" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Quicksand:wght@300;400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
