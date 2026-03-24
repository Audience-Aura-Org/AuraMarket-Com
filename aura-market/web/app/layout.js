import '../styles/globals.css';
import { Poppins } from 'next/font/google';
import Providers from '@/components/Providers';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Aura Market | Premium Multi-Vendor Platform',
  description: "Aura Market — the world's leading marketplace for premium digital and physical assets wrapped in a stunning liquid-glass interface.",
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="font-[Poppins,sans-serif] min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
