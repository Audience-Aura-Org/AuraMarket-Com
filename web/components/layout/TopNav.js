"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from '@/hooks/useAuth';
import { ShoppingCart, Search, User as UserIcon, MessageCircle, Wallet } from 'lucide-react';
import { trackSearch } from "@/services/tracking";
import cartStore from '@/services/cartStore';
import dynamic from 'next/dynamic';
import { useChat } from '@/context/ChatContext';
import { useNotifications } from '@/hooks/useNotifications';

const CartPreview = dynamic(() => import('@/components/CartPreview'), { ssr: false });

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { unreadMessages, refresh: refreshNotifications } = useNotifications();
  const [cartCount, setCartCount] = useState(cartStore.getCount());
  const [mounted, setMounted] = useState(false);
  const { openChat } = useChat();

  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Fetch initial cart count ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) {
      setCartCount(0);
      return;
    }
    const fetchCounts = () => {
      cartStore.refresh();
      refreshNotifications();
    };

    fetchCounts();
    
    // Subscribe to cart changes
    const unsubCart = cartStore.subscribe(({ count }) => {
      setCartCount(count);
    });
    window.addEventListener('focus', fetchCounts);
    document.addEventListener('visibilitychange', fetchCounts);

    return () => {
      unsubCart();
      window.removeEventListener('focus', fetchCounts);
      document.removeEventListener('visibilitychange', fetchCounts);
    };
  }, [user?._id, refreshNotifications]);

  // Hide on auth, admin, vendor, logistics, wallet, and full-screen chat pages
  if (
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/messages') ||
    pathname === '/login' ||
    pathname === '/register'
  ) return null;

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      trackSearch(search);
      router.push(`/shop?q=${search}`);
      setIsSearchOpen(false);
    }
  };

  const hideSearchIcon = pathname === '/shop' || pathname === '/discovery' || pathname === '/stores';

  return (
    <header className="sticky top-0 z-[500] w-full border-b border-[var(--nav-border)] bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-300 dark:shadow-[0_10px_36px_-12px_rgba(0,0,0,0.12)]">
      {/* iOS Dynamic Island / notch safe-area spacer */}
      <div className="w-full shrink-0" style={{ height: 'env(safe-area-inset-top)' }} aria-hidden="true" />
      <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-3 px-4 py-2.5 md:gap-4 md:px-6 md:py-4">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4 lg:gap-12 shrink-0">
          <Link href={user ? "/discovery?tab=discover" : "/"} className="flex items-center gap-2 md:gap-3 group">
            <img
              src="/icon-512.png"
              alt="Auradime"
              className="h-6 md:h-7 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </Link>
        </div>
        
        {/* Global Search Interface - Icon Only */}
        {!hideSearchIcon && (
          <div className="hidden lg:flex flex-1 justify-end mr-4">
             <button 
               onClick={() => setIsSearchOpen(!isSearchOpen)}
               className="group flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-95 dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
             >
               <Search className="size-5 transition-transform group-hover:scale-110" />
             </button>
          </div>
        )}

        {/* Actions Section */}
        <div className={`flex items-center gap-2 md:gap-4 ${hideSearchIcon ? 'ml-auto' : ''}`}>
          {/* Mobile Search Toggle */}
          {!hideSearchIcon && (
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-95 dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))] lg:hidden"
            >
              <Search className="size-5" />
            </button>
          )}

          <button 
            onClick={() => openChat(null)}
            className="relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-95 dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
          >
            <MessageCircle className="size-5" />
            {unreadMessages > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-lg animate-pulse lg:text-[12px] dark:border-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)]">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>

          {user && (
            <Link 
              href="/wallet" 
              className="relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-95 dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
              title="Wallet"
            >
              <Wallet className="size-5" />
            </Link>
          )}

          <div className="relative group/cart">
            <Link href="/cart" className="relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-95 dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]">
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-[var(--accent)] px-1 text-[10px] font-semibold leading-none text-white shadow-lg lg:text-[12px] dark:border-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)]">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            <div className="absolute right-0 mt-3 w-80 z-50 hidden md:block opacity-0 pointer-events-none group-hover/cart:opacity-100 group-hover/cart:pointer-events-auto transition-all transform-gpu translate-y-2 group-hover/cart:translate-y-0 duration-300">
              <CartPreview />
            </div>
          </div>
          
          {user ? (
            <Link 
              href={user.role === 'admin' ? '/admin/dashboard' : user.role === 'logistics' ? '/logistics/dashboard' : '/profile'} 
              className="shrink-0 relative z-[600] pointer-events-auto cursor-pointer"
            >
               <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-light)] p-0.5 shadow-xl shadow-[var(--accent)]/10 hover:scale-110 transition-all">
                 <div className="size-full rounded-full bg-[#0f0a14] flex items-center justify-center overflow-hidden dark:bg-[var(--bg-primary)]">
                    {user.branding?.logo || user.avatar ? (
                      <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt={user.name} />
                    ) : (
                      <span className="text-[11px] font-bold text-white dark:text-[var(--text-primary)]">{user.name?.[0]?.toUpperCase()}</span>
                    )}
                 </div>
               </div>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[10px] font-semibold capitalize tracking-[0.12em] text-[#0a051a] shadow-xl transition-all hover:bg-[var(--accent)] hover:text-white whitespace-nowrap active:scale-95 dark:bg-[var(--text-primary)] dark:text-[var(--bg-primary)] dark:shadow-xl lg:text-[12px] dark:hover:bg-[var(--accent)] dark:hover:text-white">
              <UserIcon className="size-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>

      {/* Standardized Search Overlay */}
      {isSearchOpen && !hideSearchIcon && (
        <div className="animate-in slide-in-from-top-4 duration-500 absolute left-0 top-full w-full border-b border-[var(--nav-border)] bg-[var(--nav-bg)] p-4 text-[var(--nav-text)] shadow-[0_16px_48px_-10px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.14)]">
          <div className="relative w-full max-w-2xl mx-auto">
            <input 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search products, vendors, and management..."
              className="w-full rounded-full border border-white/15 bg-white/10 py-3.5 pl-6 pr-14 text-sm font-bold text-[var(--nav-text)] shadow-inner outline-none transition-all placeholder:text-white/40 focus:ring-1 focus:ring-[var(--accent)] dark:border-[var(--glass-border)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-secondary)] dark:placeholder:opacity-60"
            />
            <button 
              onClick={() => { trackSearch(search); router.push(`/shop?q=${search}`); setIsSearchOpen(false); }} 
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-10 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <Search className="size-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
