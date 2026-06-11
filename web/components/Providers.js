'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import SocketProvider from '@/components/SocketProvider';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import { ChatProvider } from '@/context/ChatContext';
import dynamic from 'next/dynamic';
import SplashScreen from '@/components/layout/SplashScreen';
import { useAuthStore } from '@/hooks/useAuth';

// ── Lazy-loaded components — not needed on first paint ─────────────────────
const Toaster = dynamic(() => import('react-hot-toast').then(mod => mod.Toaster), { ssr: false });
import { AnimatePresence } from 'framer-motion';

// Heavy sidebar & overlay — deferred until after hydration
const CartSidebar = dynamic(() => import('@/components/CartSidebar'), { ssr: false });
const GlobalChatOverlay = dynamic(() => import('@/components/layout/GlobalChatOverlay'), { ssr: false });
const PWAInit = dynamic(() => import('@/components/PWAInit'), { ssr: false });
const MobileKeyboardRecovery = dynamic(() => import('@/components/MobileKeyboardRecovery'), { ssr: false });
const NativeBackButtonHandler = dynamic(() => import('@/components/NativeBackButtonHandler'), { ssr: false });

// Navigation & footer — visible but non-critical for first paint
const BottomNav = dynamic(() => import('@/components/layout/BottomNav'), { ssr: false });
const Footer = dynamic(() => import('@/components/layout/Footer'), { ssr: false });

export default function Providers({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  const isDashboardRoute = normalizedPath.startsWith('/admin') ||
                          normalizedPath.startsWith('/vendor') ||
                          normalizedPath.startsWith('/logistics');
  const [showSplash, setShowSplash] = useState(!isDashboardRoute);

  useEffect(() => {
    if (isDashboardRoute) {
      setShowSplash(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isDashboardRoute]);

  useEffect(() => {
    const handleInvalidSession = async () => {
      await logout();
      router.replace('/login');
    };

    window.addEventListener('aura:session-invalidated', handleInvalidSession);
    return () => window.removeEventListener('aura:session-invalidated', handleInvalidSession);
  }, [logout, router]);

  useEffect(() => {
    const handleSubscriptionRequired = (event) => {
      const redirect = event.detail?.redirect || '/subscribe';
      router.replace(redirect);
    };

    window.addEventListener('aura:subscription-required', handleSubscriptionRequired);
    return () => window.removeEventListener('aura:subscription-required', handleSubscriptionRequired);
  }, [router]);

  const isAuthRoute =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/auth') ||
    normalizedPath === '/login' ||
    normalizedPath === '/register' ||
    normalizedPath === '/onboarding';

  /** Full-screen chat (WhatsApp-style) — hide storefront chrome so it doesn’t frame MessagingHub */
  const isImmersiveChat =
    normalizedPath === '/chat' ||
    normalizedPath === '/messages';

  const footerRoutes = [
    '/privacy',
    '/privacy-policy',
    '/terms',
    '/terms-of-service',
    '/cookies',
    '/rules',
  ];
  const showReducedFooter = footerRoutes.includes(normalizedPath);
  
  return (
    <ThemeProvider>
      <LanguageProvider>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
        }}
      />
      <ChatProvider>
        <SocketProvider>
          {/* PWA initializers — fully deferred */}
          <PWAInit />
          <MobileKeyboardRecovery />
          <NativeBackButtonHandler />

          {/* Onboarding gate — lightweight, needed on every route */}
          <OnboardingWatcher />

          {/* Dashboard routes render their own sidebar-aware mobile header. */}
          {!isImmersiveChat && !isDashboardRoute && !isAuthRoute && <TopNav />}

          <div className="flex w-full items-stretch flex-1 relative">
            <main className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 flex flex-col">
                {children}
              </div>
              {!isDashboardRoute && !isAuthRoute && !isImmersiveChat && showReducedFooter && <Footer />}
            </main>
            {/* Cart sidebar — only on storefront routes */}
            {!isDashboardRoute && !isAuthRoute && !isImmersiveChat && <CartSidebar />}
          </div>

          {!isAuthRoute && !isImmersiveChat && <BottomNav />}

          {/* Global chat overlay — deferred, heavy */}
          {!isAuthRoute && <GlobalChatOverlay />}
        </SocketProvider>
      </ChatProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
