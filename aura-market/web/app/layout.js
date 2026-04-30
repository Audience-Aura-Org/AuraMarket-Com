import '../styles/globals.css';
import { Poppins } from 'next/font/google';
import Providers from '@/components/Providers';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Aura Market | Premium Multi-Vendor Platform',
  description: "Aura Market — the world's leading marketplace for premium digital and physical assets wrapped in a stunning liquid-glass interface.",
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'Aura Market',
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
    <html lang="en" className={poppins.variable} data-scroll-behavior="smooth">
      <head>
        {/* Viewport: interactive-widget=resizes-visual prevents iOS PWA keyboard freeze */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual"
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
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
