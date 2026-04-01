'use client';

import { useEffect, useState } from 'react';
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
import cartStore from '@/services/cartStore';

export default function Providers({ children }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(cartStore.getSidebarState());
  
  const isMessagesPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat');
  const isFullFlow = ['/checkout', '/login', '/register', '/onboarding', '/cart'].some(r => pathname?.startsWith(r));

  useEffect(() => {
    // Sync sidebar state from store
    const unsub = cartStore.subscribe(({ isSidebarOpen: open }) => {
      setIsSidebarOpen(open);
    });
    return unsub;
  }, []);

  // Viewport stabilization for fixed dashboard layout
  useEffect(() => {
    if (!isFullFlow) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
  }, [pathname, isFullFlow]);

  return (
    <ThemeProvider>
      <SocketProvider>
        <PWAInit />
        <PWAInstallBanner />
        <OnboardingWatcher />
        
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-[var(--bg-secondary)]">
          <TopNav />
          
          <div className="flex flex-row flex-1 overflow-hidden relative">
            <main 
              id="main-scroll-container" 
              className="flex-1 overflow-y-auto flex flex-col relative transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            >
              <div className="flex-1 w-full">
                {children}
              </div>
              {!isMessagesPage && (
                <div className="w-full mt-auto">
                    <Footer />
                </div>
              )}
            </main>
            
            <CartSidebar />
          </div>
          
          <BottomNav />
        </div>
      </SocketProvider>
    </ThemeProvider>
  );
}
