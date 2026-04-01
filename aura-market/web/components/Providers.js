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
  
  const isMessagesPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  
  // High-density flows where sidebar should stay closed or never show
  const isFullFlow = ['/checkout', '/login', '/register', '/onboarding', '/cart'].some(r => pathname?.startsWith(r));

  useEffect(() => {
    const unsub = cartStore.subscribe(({ isSidebarOpen: open }) => {
      setIsSidebarOpen(open);
    });
    return unsub;
  }, []);

  // Force scroll behavior
  useEffect(() => {
    if (!isFullFlow) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
  }, [pathname, isFullFlow]);

  // We push content ONLY on desktop when the sidebar is open and NOT on a full-flow or cart page
  // The sidebar is "Always out" (default true) per user request.
  const shouldPush = isSidebarOpen && !isFullFlow;

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
              className={`
                flex-1 overflow-y-auto flex flex-col relative no-scrollbar transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
                ${shouldPush ? 'lg:mr-[280px]' : 'lg:mr-0'}
              `}
            >
              <div className="flex-1">
                {children}
              </div>
              {!isMessagesPage && <Footer />}
            </main>
            
            <CartSidebar />
          </div>
          
          <BottomNav />
        </div>
      </SocketProvider>
    </ThemeProvider>
  );
}
