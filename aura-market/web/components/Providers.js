'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import SocketProvider from '@/components/SocketProvider';
import CartSidebar from '@/components/CartSidebar';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import BottomNav from '@/components/layout/BottomNav';
import Footer from '@/components/layout/Footer';

import PWAInit from '@/components/PWAInit';
import PWAInstallBanner from '@/components/layout/PWAInstallBanner';
import { usePathname } from 'next/navigation';

export default function Providers({ children }) {
  const pathname = usePathname();
  const isMessagesPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  
  // Force clean viewport on messaging apps
  useEffect(() => {
    if (isMessagesPage) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isMessagesPage]);

  return (
    <ThemeProvider>
      <SocketProvider>
        <PWAInit />
        <PWAInstallBanner />
        <OnboardingWatcher />
        <TopNav />
        <div className="flex flex-row items-stretch w-full">
          <main className="flex-1 flex flex-col min-h-screen min-w-0">
            {children}
            {!isMessagesPage && <Footer />}
          </main>
          <CartSidebar />
        </div>
        <BottomNav />
      </SocketProvider>
    </ThemeProvider>
  );
}
