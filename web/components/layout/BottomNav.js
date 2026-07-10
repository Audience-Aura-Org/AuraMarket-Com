"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass, User, House, Store, Activity, LayoutDashboard, Lock
} from "lucide-react";
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { motion } from "framer-motion";
import { useLanguage } from '@/context/LanguageContext';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isOpen: chatOpen } = useChat();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChatPage = pathname?.startsWith('/chat') || pathname?.startsWith('/messages') || pathname?.startsWith('/admin/messages');
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/onboarding');
  const isDiscoveryPage = pathname?.startsWith('/discovery');
  const isShopSurface =
    pathname === '/shop' ||
    pathname?.startsWith('/shop/') ||
    pathname?.startsWith('/products') ||
    pathname?.startsWith('/stores') ||
    pathname?.startsWith('/cart') ||
    pathname?.startsWith('/checkout');
  
  if (!mounted) return null;

  if (chatOpen || isChatPage || isAuthPage) return null;
  // If discovery hub uses its own exact replica, we can hide this one to prevent double rendering.
  if (isDiscoveryPage) return null;

  const isCustomer = user?.role === 'customer';
  const dashboardHref = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'logistics' ? '/logistics/dashboard' : '/vendor/dashboard';

  const storiesHref = user?.role === 'vendor' ? "/vendor/stories" : "/discovery?tab=status";

  const guestMenu = [
    { label: t('bottomNav.discovery', 'Discovery'), href: "/shop",               icon: Compass,       locked: false },
    { label: t('bottomNav.vendors',   'Vendors'),   href: "/discovery?tab=vendors", icon: Store,       locked: true  },
    { label: t('bottomNav.stories',   'Stories'),   href: "/status",             icon: Activity,       locked: true  },
    { label: t('bottomNav.overtime',  'Overtime'),  href: "/overtime",           icon: House,          locked: true  },
    { label: t('bottomNav.profile',   'Profile'),   href: "/profile",            icon: User,           locked: true  },
  ];

  const customerMenu = [
    { label: t('bottomNav.discovery', 'Discovery'), href: "/shop",               icon: Compass },
    { label: t('bottomNav.vendors',   'Vendors'),   href: "/discovery?tab=vendors", icon: Store },
    { label: t('bottomNav.stories',   'Stories'),   href: "/discovery?tab=status", icon: Activity },
    { label: t('bottomNav.overtime',  'Overtime'),  href: "/overtime",           icon: House },
    { label: t('bottomNav.profile',   'Profile'),   href: "/profile",            icon: User },
  ];

  const vendorMenu = [
    { label: t('bottomNav.dashboard', 'Dashboard'), href: dashboardHref,         icon: LayoutDashboard },
    { label: t('bottomNav.discovery', 'Discovery'), href: "/shop",               icon: Compass },
    { label: t('bottomNav.stories',   'Stories'),   href: storiesHref,           icon: Activity },
    { label: t('bottomNav.overtime',  'Overtime'),  href: "/overtime",           icon: House },
    { label: t('bottomNav.profile',   'Profile'),   href: "/profile",            icon: User },
  ];

  const menu = !user ? guestMenu : isCustomer ? customerMenu : vendorMenu;

  const isItemActive = (item) => {
    const [itemPath, itemQuery = ''] = item.href.split('?');
    const itemTab = new URLSearchParams(itemQuery).get('tab');

    if (item.href === '/') return pathname === '/';
    if (item.href === '/shop' && isShopSurface) return true;

    if (itemTab) {
      const currentTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
      return pathname === itemPath && currentTab === itemTab;
    }

    return pathname?.startsWith(itemPath);
  };

  return (
    <>
      <div
        className="pointer-events-none sm:hidden"
        style={{ height: "calc(68px + env(safe-area-inset-bottom, 0px))" }}
      />
      {/* Mobile Bottom Nav — aligned with Discovery Hub */}
      <nav className="fixed bottom-0 left-0 right-0 z-[500] w-full overflow-hidden rounded-t-[24px] border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_8%,transparent),0_-8px_32px_-8px_rgba(0,0,0,0.14)] backdrop-blur-xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] sm:hidden dark:shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_10%,transparent),0_-10px_36px_-8px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative flex h-[68px] w-full items-center justify-around px-1 pt-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            const locked = !!item.locked;

            const inner = (
              <>
                <div
                  className={`relative rounded-xl p-1.5 transition-colors duration-200 ${
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
                      : "bg-transparent"
                  }`}
                >
                  <Icon className="size-5 shrink-0 stroke-2 transition-colors" />
                  {locked && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[var(--bg-secondary)] rounded-full p-[2px]">
                      <Lock className="size-2.5 text-[var(--text-secondary)] opacity-60" />
                    </span>
                  )}
                </div>
                <span
                  className={`max-w-full truncate px-0.5 text-[10px] font-medium leading-none tracking-tight transition-colors min-[380px]:text-[11px] font-[Poppins] ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] opacity-90"
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="global-nav-indicator"
                    className="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-80"
                  />
                )}
              </>
            );

            if (locked) {
              return (
                <button
                  key={item.label}
                  onClick={() => router.push('/login?from=' + encodeURIComponent(pathname || '/'))}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 opacity-45 transition-opacity duration-200 active:scale-[0.98] text-[var(--text-secondary)]"
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200 active:scale-[0.98] ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Floating Dock Fallback */}
      <nav className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-lg pointer-events-auto">
        <div className="flex items-center h-[54px] bg-black/50 backdrop-blur-2xl border border-white/10 rounded-[22px] shadow-[0_12px_40px_rgba(0,0,0,0.22)] px-1.5 overflow-hidden">
          {menu.map((item, idx) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            const locked = !!item.locked;

            const itemContent = (
              <>
                <div className="relative">
                  <Icon className={`size-[20px] stroke-2 ${isActive ? 'text-[var(--accent)]' : 'text-white/45'}`} />
                  {locked && (
                    <span className="absolute -top-0.5 -right-1 bg-black/40 rounded-full p-[2px]">
                      <Lock className="size-2.5 text-white/40" />
                    </span>
                  )}
                </div>
                <span className={`max-w-[82px] truncate text-[10px] font-medium tracking-tight mt-1.5 md:text-[11px] font-[Poppins] ${isActive ? 'text-[var(--accent)]' : 'text-white/45'}`}>{item.label}</span>
              </>
            );

            return (
              <div key={item.label} className={`flex-1 flex items-center h-full ${locked ? 'opacity-40' : ''}`}>
                {idx > 0 && <div className="w-px h-3 bg-white/10" />}
                {locked ? (
                  <button
                    onClick={() => router.push('/login?from=' + encodeURIComponent(pathname || '/'))}
                    className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 relative"
                  >
                    {itemContent}
                  </button>
                ) : (
                  <Link href={item.href} className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 hover:text-white/80 relative">
                    {itemContent}
                    {isActive && (
                      <motion.div
                        layoutId="global-desktop-nav-indicator"
                        className="absolute bottom-0 inset-x-10 h-0.5 bg-[var(--accent)] opacity-80"
                      />
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
