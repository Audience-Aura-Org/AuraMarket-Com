'use client';

import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  
  // Check if we're on a dashboard route (admin/vendor) - these have their own layout with footer
  const isDashboardRoute = pathname?.startsWith('/admin') || 
                          pathname?.startsWith('/vendor') || 
                          pathname === '/wallet';
  
  return (
    <ThemeProvider>
      <SocketProvider>
        <PWAInit />
        <PWAInstallBanner />
        <OnboardingWatcher />
        {!isDashboardRoute && <TopNav />}
        <div className="flex w-full items-stretch flex-1 relative">
          <main className={`flex-1 flex flex-col min-h-screen min-w-0 ${isDashboardRoute ? '' : ''}`}>
            {children}
            {!isDashboardRoute && <Footer />}
          </main>
          {!isDashboardRoute && <CartSidebar />}
        </div>
        {!isDashboardRoute && <BottomNav />}
      </SocketProvider>
    </ThemeProvider>
  );
}
