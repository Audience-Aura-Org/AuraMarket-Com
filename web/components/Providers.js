'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { UploadQueueProvider } from '@/context/UploadQueueContext';
import SocketProvider from '@/components/SocketProvider';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import SubscriptionAccessNotice from '@/components/layout/SubscriptionAccessNotice';
import { ChatProvider } from '@/context/ChatContext';
import { NotificationProvider } from '@/context/NotificationContext';
import dynamic from 'next/dynamic';
import SplashScreen from '@/components/layout/SplashScreen';
import { useAuthStore } from '@/hooks/useAuth';
import { initFontSettings } from '@/utils/fontSettings';
import { hasPendingPushIntent } from '@/lib/native-push';

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
const FloatingUploadBadge = dynamic(() => import('@/components/ui/FloatingUploadBadge'), { ssr: false });

export default function Providers({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const normalizedPath = pathname?.replace(/\/+$/, '') || '/';
  const isDashboardRoute = normalizedPath.startsWith('/admin') ||
                          normalizedPath.startsWith('/vendor') ||
                          normalizedPath.startsWith('/logistics') ||
                          normalizedPath === '/subscribe';
  // Chat and messages pages are full-screen immersive — they should open
  // immediately with no splash delay (same as dashboard routes).
  const isImmediateRoute = isDashboardRoute ||
                           normalizedPath.startsWith('/chat') ||
                           normalizedPath.startsWith('/messages');
  // APK uses the same web SplashScreen as PWA for a consistent branded experience.
  // Skip splash when:
  //  • the initial route is a dashboard / chat / messages page
  //  • the app opened from a native push notification tap (APK intent stored in localStorage)
  //  • the app opened via a PWA push notification that navigated directly to /chat
  const [showSplash, setShowSplash] = useState(
    !isImmediateRoute && !hasPendingPushIntent()
  );

  useEffect(() => {
    initFontSettings();
  }, []);

  useEffect(() => {
    if (isImmediateRoute) {
      setShowSplash(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isImmediateRoute]);

  useEffect(() => {
    const handleInvalidSession = async () => {
      await logout();
      router.replace('/login');
    };

    window.addEventListener('aura:session-invalidated', handleInvalidSession);
    return () => window.removeEventListener('aura:session-invalidated', handleInvalidSession);
  }, [logout, router]);

  const isAuthRoute =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/auth') ||
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
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
      <UploadQueueProvider>
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
        <NotificationProvider>
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
            <main className={`flex-1 flex flex-col min-w-0${(!isAuthRoute && !isImmersiveChat) ? ' pb-[calc(68px+env(safe-area-inset-bottom,0px))] sm:pb-24' : ''}`}>
              {!isDashboardRoute && <SubscriptionAccessNotice />}
              <div className="flex-1 flex flex-col">
                {children}</div>
              {!isDashboardRoute && !isAuthRoute && !isImmersiveChat && showReducedFooter && <Footer />}
            </main>
            {/* Cart sidebar — only on storefront routes */}
            {!isDashboardRoute && !isAuthRoute && !isImmersiveChat && <CartSidebar />}
          </div>

          {!isAuthRoute && !isImmersiveChat && <BottomNav />}

          {/* Floating upload progress ring — persists across navigation */}
          <FloatingUploadBadge />

          {/* Global chat overlay — deferred, heavy */}
          {!isAuthRoute && <GlobalChatOverlay />}
        </SocketProvider>
        </NotificationProvider>
      </ChatProvider>
      </UploadQueueProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
