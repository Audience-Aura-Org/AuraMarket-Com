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
  const [cartCount, setCartCount] = useState(0);
  
  const isMessagesPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  
  // Pages where the sidebar should never appear
  const hiddenRoutes = ['/cart', '/checkout', '/login', '/register', '/admin', '/vendor', '/logistics', '/chat'];
  const isCartHidden = hiddenRoutes.some(r => pathname?.startsWith(r));

  // Subscribe to cart to know if we should indent the layout for the fixed sidebar
  useEffect(() => {
    const unsub = cartStore.subscribe(({ count }) => {
      setCartCount(count);
    });
    return unsub;
  }, []);

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

  const showSidebar = !isCartHidden && cartCount > 0;

  return (
    <ThemeProvider>
      <SocketProvider>
        <PWAInit />
        <PWAInstallBanner />
        <OnboardingWatcher />
        <TopNav />
        
        {/* Dynamic layout container */}
        <div className="flex flex-row w-full min-h-screen">
          <main 
            className={`
              flex-1 flex flex-col min-w-0 transition-all duration-300
              ${showSidebar ? 'lg:mr-[260px]' : 'lg:mr-0'}
            `}
          >
            {children}
            {!isMessagesPage && <Footer />}
          </main>
          
          {/* CartSidebar is now fixed (handled inside its component), but we leave this here for consistency */}
          <CartSidebar />
        </div>
        
        <BottomNav />
      </SocketProvider>
    </ThemeProvider>
  );
}
