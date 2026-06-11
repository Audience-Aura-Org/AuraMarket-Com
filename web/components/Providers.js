'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { useLanguage } from '@/context/LanguageContext';
import SocketProvider from '@/components/SocketProvider';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import { ChatProvider } from '@/context/ChatContext';
import dynamic from 'next/dynamic';
import SplashScreen from '@/components/layout/SplashScreen';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';

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
              <SubscriptionAccessNotice
                normalizedPath={normalizedPath}
                isAuthRoute={isAuthRoute}
                isImmersiveChat={isImmersiveChat}
              />
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

function SubscriptionAccessNotice({ normalizedPath, isAuthRoute, isImmersiveChat }) {
  const router = useRouter();
  const { t } = useLanguage();
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleSubscriptionRequired = (event) => {
      setNotice(event.detail?.data || event.detail || null);
      setHidden(false);
    };

    window.addEventListener('aura:subscription-required', handleSubscriptionRequired);
    return () => window.removeEventListener('aura:subscription-required', handleSubscriptionRequired);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const shouldCheck =
      user?._id &&
      user?.role &&
      user.role !== 'admin' &&
      !isAuthRoute &&
      !isImmersiveChat &&
      normalizedPath !== '/subscribe';

    if (!shouldCheck) {
      setNotice(null);
      return undefined;
    }

    const loadStatus = async () => {
      try {
        const res = await api.get('/subscriptions/me', {
          params: { role: user.role },
          skipClientCache: true,
          silent: true,
        });
        if (cancelled) return;
        const data = res.data?.data;
        if (data?.required && (!data.subscribed || data.grace || data.limited)) {
          setNotice(data);
        } else {
          setNotice(null);
          setHidden(false);
        }
      } catch {
        if (!cancelled) setNotice(null);
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role, normalizedPath, isAuthRoute, isImmersiveChat]);

  if (!notice?.required || isAuthRoute || isImmersiveChat || normalizedPath === '/subscribe') {
    return null;
  }

  const role = notice.role || user?.role || 'vendor';
  const isGrace = notice.access_state === 'grace' || notice.grace;
  const isVendor = role === 'vendor';
  const title = isGrace
    ? t('subscription.graceTitle', 'Subscription grace active')
    : t('subscription.limitedTitle', 'Limited access mode');
  const detail = isGrace
    ? (isVendor
        ? t('subscription.vendorGraceInline', 'Your vendor tools are available during grace. Activate a package to keep selling without interruption.')
        : t('subscription.graceDetail', 'You can keep using your workspace during this grace period. Activate a package before it ends to keep full access.'))
    : t('subscription.limitedDetail', 'You can still view your dashboard, but subscription-gated actions are paused until you activate a package.');

  const severityClass = isGrace
    ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  const actionClass = isGrace ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className={`w-full border-b px-3 py-2 ${severityClass}`}>
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 sm:gap-3">
        <span className={`size-2 shrink-0 rounded-full ${isGrace ? 'bg-amber-500' : 'bg-rose-500'}`} />
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={!hidden}
        >
          <p className="truncate text-[11px] font-black uppercase tracking-wide sm:text-xs">{title}</p>
          {!hidden && (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 opacity-90 sm:text-xs sm:leading-5">{detail}</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/subscribe?role=${encodeURIComponent(role)}`)}
          className={`h-8 shrink-0 rounded-xl px-3 text-[10px] font-bold text-white transition active:scale-95 sm:h-9 sm:px-4 sm:text-xs ${actionClass}`}
        >
          {t('subscription.subscribeCta', 'Subscribe')}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="h-8 shrink-0 rounded-xl border border-current/20 px-2 text-[10px] font-bold transition active:scale-95 sm:px-3 sm:text-xs"
        >
          {t('common.hide', 'Hide')}
        </button>
      </div>
    </div>
  );
}
