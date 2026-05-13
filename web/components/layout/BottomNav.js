"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, User, House, Store, Activity, LayoutDashboard
} from "lucide-react";
import { useAuthStore } from '@/hooks/useAuth';
import { motion } from "framer-motion";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChatPage = pathname?.startsWith('/chat') || pathname?.startsWith('/messages') || pathname?.startsWith('/admin/messages');
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/onboarding');
  const isDiscoveryPage = pathname?.startsWith('/discovery');
  
  // ─── Skeleton State ────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[500] w-full animate-pulse rounded-t-[28px] border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:hidden"
        style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex h-[72px] items-center justify-around px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="size-10 rounded-xl bg-[color-mix(in_srgb,var(--text-primary)_8%,transparent)]" />
          ))}
        </div>
      </div>
    );
  }

  if (isChatPage || isAuthPage) return null;
  // If discovery hub uses its own exact replica, we can hide this one to prevent double rendering.
  if (isDiscoveryPage) return null;

  const isCustomer = !user || user.role === 'customer';
  const dashboardHref = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'logistics' ? '/logistics/dashboard' : '/vendor/dashboard';

  const menu = isCustomer ? [
    { label: "Shop", href: "/discovery?tab=discover", icon: Compass },
    { label: "Vendors", href: "/discovery?tab=vendors", icon: Store },
    { label: "Stories", href: "/discovery?tab=status", icon: Activity },
    { label: "Overtime", href: "/overtime", icon: House },
    { label: "Profile", href: "/profile", icon: User }
  ] : [
    { label: "Dashboard", href: dashboardHref, icon: LayoutDashboard },
    { label: "Shop", href: "/discovery?tab=discover", icon: Compass },
    { label: "Aura Story", href: "/discovery?tab=status", icon: Activity },
    { label: "Overtime", href: "/overtime", icon: House },
    { label: "Profile", href: "/profile", icon: User }
  ];

  return (
    <>
      <div
        className="pointer-events-none sm:hidden"
        style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
      />
      {/* Mobile Bottom Nav — aligned with Discovery Hub */}
      <nav className="fixed bottom-0 left-0 right-0 z-[500] w-full overflow-hidden rounded-t-[28px] border-t border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-primary)_92%,transparent)] shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_12%,transparent),0_-12px_44px_-6px_rgba(0,0,0,0.32)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--bg-primary)_82%,transparent)] sm:hidden dark:shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_18%,transparent),0_-14px_48px_-4px_rgba(0,0,0,0.55)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative flex h-[72px] w-full items-center justify-around px-1 pt-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            // Strict exact match for root '/' to avoid highlighting Vendor everywhere
            const itemPath = item.href.split('?')[0];
            const itemTab = new URLSearchParams(item.href.split('?')[1]).get('tab');
            
            let isActive = false;
            if (item.href === '/') {
              isActive = pathname === '/';
            } else if (itemTab) {
              const currentTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
              isActive = pathname === itemPath && currentTab === itemTab;
            } else {
              isActive = pathname?.startsWith(itemPath);
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all duration-200 active:scale-[0.97] ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div
                  className={`relative rounded-2xl p-2 transition-all duration-300 ${
                    isActive
                      ? "scale-[1.06] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent),0_8px_20px_-6px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                      : "bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]"
                  }`}
                >
                  <Icon className={`size-[22px] shrink-0 transition-all ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                  {isActive && (
                    <div className="absolute -right-0.5 -top-0.5 size-1.5 animate-pulse rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                  )}
                </div>

                <span
                  className={`max-w-full truncate px-0.5 text-[10px] font-semibold tracking-wide transition-colors ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {item.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="global-nav-indicator"
                    className="absolute bottom-1 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Floating Dock Fallback */}
      <nav className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-lg pointer-events-auto">
        <div className="flex items-center h-[58px] bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-1.5 overflow-hidden">
          {menu.map((item, idx) => {
            const Icon = item.icon;
            const itemPath = item.href.split('?')[0];
            const itemTab = new URLSearchParams(item.href.split('?')[1]).get('tab');
            
            let isActive = false;
            if (item.href === '/') {
              isActive = pathname === '/';
            } else if (itemTab) {
              const currentTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
              isActive = pathname === itemPath && currentTab === itemTab;
            } else {
              isActive = pathname?.startsWith(itemPath);
            }

            const itemContent = (
              <>
                  <Icon className={`size-5 ${isActive ? 'stroke-[2.5px] text-[var(--accent)]' : 'stroke-2 text-white/50'}`} />
                  <span className={`text-[10px] lg:text-[12px] font-medium tracking-[0.02em] mt-2 ${isActive ? 'text-[var(--accent)]' : 'text-white/50'}`}>{item.label}</span>
              </>
            );

            return (
              <div key={item.label} className="flex-1 flex items-center h-full">
                {idx > 0 && <div className="w-px h-3 bg-white/10" />}
                <Link href={item.href} className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 hover:text-white/80 relative">
                  {itemContent}
                  {isActive && (
                    <motion.div 
                      layoutId="global-desktop-nav-indicator" 
                      className="absolute bottom-0 inset-x-8 h-[2px] bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" 
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
