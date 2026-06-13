import '../styles/globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  metadataBase: new URL('https://auradime.com'),
  title: {
    default: 'Auradime | Shop Premium Products from Trusted Sellers',
    template: '%s | Auradime',
  },
  description: 'Auradime is a premium marketplace for buying and selling quality digital and physical products, built for trusted commerce in Cameroon and Africa.',
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'fr-CM': '/',
    },
  },
  openGraph: {
    title: 'Auradime | Shop Premium Products from Trusted Sellers',
    description: 'A premium marketplace for trusted buying, selling, logistics, and fulfilment in Cameroon and Africa.',
    url: 'https://auradime.com',
    siteName: 'Auradime',
    images: [
      { url: '/icon-512.png?v=8', width: 512, height: 512, alt: 'Auradime logo' },
    ],
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Auradime | Shop Premium Products from Trusted Sellers',
    description: 'A premium marketplace for trusted buying, selling, logistics, and fulfilment in Cameroon and Africa.',
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {/* Viewport: resizes chat content when the virtual keyboard opens in PWA/WebView */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content="#0a050a" />
        {/* Dynamic Theme-Aware Favicons */}
        <link rel="icon" href="/icon-192.png?v=8" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/icon-512.png?v=8" media="(prefers-color-scheme: dark)" />
        {/* Fallback for browsers that don't support media queries on icons */}
        <link rel="shortcut icon" href="/icon-512.png?v=8" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
