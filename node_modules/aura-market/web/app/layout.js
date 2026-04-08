import '../styles/globals.css';
import { Poppins, Quicksand } from 'next/font/google';
import Providers from '@/components/Providers';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

const quicksand = Quicksand({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-quicksand',
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
      { url: '/logo-black.png', media: '(prefers-color-scheme: light)' },
      { url: '/logo-white.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: [
      { url: '/logo-white.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable} data-scroll-behavior="smooth">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-[Poppins,sans-serif] min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
