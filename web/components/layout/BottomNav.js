"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, User, House, Store, Activity
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
  const isRolePage = pathname?.startsWith('/wallet') || pathname?.startsWith('/admin') || pathname?.startsWith('/vendor') || pathname?.startsWith('/logistics');
  // We DO want to show this on discovery page if discovery doesn't have its own, but currently discovery has its own.
  const isDiscoveryPage = pathname?.startsWith('/discovery');

  if (!mounted || isChatPage || isAuthPage || isRolePage) return null;
  // If discovery hub uses its own exact replica, we can hide this one to prevent double rendering.
  if (isDiscoveryPage) return null;

  const menu = [
    { label: "Vendor", href: "/", icon: Store },
    { label: "Aura Story", href: "/discovery?tab=status", icon: Activity },
    { label: "Shop", href: "/discovery?tab=discover", icon: ShoppingBag },
    { label: "Overtime", href: "/overtime", icon: House },
    { label: "Profile", href: "/profile", icon: User },
  ];

  return (
    <>
      <div className="h-[72px] sm:hidden pointer-events-none" />
      {/* Mobile Bottom Nav - Exact match of Discovery Hub */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] w-full backdrop-blur-2xl bg-white/[0.02] border-t border-white/[0.08] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] rounded-t-[32px] overflow-hidden sm:hidden">
        <div className="flex items-center justify-around h-[72px] px-2 pb-2 pt-1 relative w-full">
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
                className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 relative ${
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'
                }`}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-500 ${isActive ? 'bg-[var(--accent)]/10 scale-105 shadow-lg shadow-[var(--accent)]/10' : ''}`}>
                  <Icon className={`size-5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                  )}
                </div>
                
                <span className={`text-[9px] font-bold mt-1 transition-all ${
                  isActive ? 'text-[var(--accent)] opacity-100' : 'text-[var(--text-secondary)] opacity-60'
                }`}>
                  {item.label}
                </span>

                {isActive && (
                  <motion.div 
                    layoutId="global-nav-indicator" 
                    className="absolute bottom-0 inset-x-6 h-[3px] bg-[var(--accent)] rounded-full shadow-[0_0_12px_var(--accent)]" 
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Floating Dock Fallback */}
      <nav className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg pointer-events-auto">
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
                 <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-[var(--accent)]' : 'text-white/50'}`}>{item.label}</span>
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
