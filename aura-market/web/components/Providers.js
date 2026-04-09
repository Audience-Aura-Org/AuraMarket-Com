'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import SocketProvider from '@/components/SocketProvider';
import CartSidebar from '@/components/CartSidebar';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import BottomNav from '@/components/layout/BottomNav';
import Footer from '@/components/layout/Footer';

import PWAInit from '@/components/PWAInit';
import PWAInstallBanner from '@/components/layout/PWAInstallBanner';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <SocketProvider>
        <PWAInit />
        <PWAInstallBanner />
        <OnboardingWatcher />
        <TopNav />
        <div className="flex w-full items-stretch flex-1">
          <main className="flex-1 flex flex-col min-h-screen min-w-0">
            {children}
            <Footer />
          </main>
          <CartSidebar />
        </div>
        <BottomNav />
      </SocketProvider>
    </ThemeProvider>
  );
}
