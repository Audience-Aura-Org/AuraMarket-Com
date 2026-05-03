'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/context/ThemeContext';
import SocketProvider from '@/components/SocketProvider';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import { ChatProvider } from '@/context/ChatContext';
import dynamic from 'next/dynamic';

// ── Lazy-loaded components — not needed on first paint ─────────────────────
const Toaster = dynamic(() => import('react-hot-toast').then(mod => mod.Toaster), { ssr: false });

// Heavy sidebar & overlay — deferred until after hydration
const CartSidebar = dynamic(() => import('@/components/CartSidebar'), { ssr: false });
const GlobalChatOverlay = dynamic(() => import('@/components/layout/GlobalChatOverlay'), { ssr: false });
const PWAInstallBanner = dynamic(() => import('@/components/layout/PWAInstallBanner'), { ssr: false });
const PWAInit = dynamic(() => import('@/components/PWAInit'), { ssr: false });

// Navigation & footer — visible but non-critical for first paint
const BottomNav = dynamic(() => import('@/components/layout/BottomNav'), { ssr: false });
const Footer = dynamic(() => import('@/components/layout/Footer'), { ssr: false });

export default function Providers({ children }) {
  const pathname = usePathname();
  
  const isDashboardRoute = pathname?.startsWith('/admin') || 
                          pathname?.startsWith('/vendor') ||
                          pathname?.startsWith('/logistics');

  const isAuthRoute = pathname?.startsWith('/auth') || pathname === '/onboarding';
  
  return (
    <ThemeProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
        }}
      />
      <SocketProvider>
        <ChatProvider>
          {/* PWA initializers — fully deferred */}
          <PWAInit />
          {!isAuthRoute && <PWAInstallBanner />}

          {/* Onboarding gate — lightweight, needed on every route */}
          <OnboardingWatcher />

          {/* Top navigation — eager on non-dashboard routes */}
          {!isDashboardRoute && <TopNav />}

          <div className="flex w-full items-stretch flex-1 relative">
            <main className="flex-1 flex flex-col min-h-screen min-w-0">
              {children}
              {!isDashboardRoute && !isAuthRoute && <Footer />}
            </main>
            {/* Cart sidebar — only on storefront routes */}
            {!isDashboardRoute && !isAuthRoute && <CartSidebar />}
          </div>

          {!isAuthRoute && <BottomNav />}

          {/* Global chat overlay — deferred, heavy */}
          {!isAuthRoute && <GlobalChatOverlay />}
        </ChatProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}
