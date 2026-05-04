"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from '@/hooks/useAuth';
import { ShoppingCart, Search, User as UserIcon, Moon, Sun, MessageCircle, Wallet } from 'lucide-react';
import { useTheme } from "@/context/ThemeContext";
import { trackSearch } from "@/services/tracking";
import api from '@/services/api';
import socketService from '@/services/socket';
import cartStore from '@/services/cartStore';
import dynamic from 'next/dynamic';
import { useChat } from '@/context/ChatContext';

const CartPreview = dynamic(() => import('@/components/CartPreview'), { ssr: false });

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartCount, setCartCount] = useState(cartStore.getCount());
  const [mounted, setMounted] = useState(false);
  const { openChat } = useChat();

  useEffect(() => {
    setMounted(true);
  }, []);

  // ─── Fetch initial cart count ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;
    const fetchCounts = () => {
      // Use cartStore.refresh() instead of manual fetch to get benefits of deduplication and token checks
      cartStore.refresh();
      
      // Token check for chat
      const hasToken = !!localStorage.getItem('aura_token') || !!localStorage.getItem('aura-auth-storage');
      if (hasToken) {
        api.get('/chat').then(res => {
          if (res.data?.success) {
            const count = res.data.data.activeChats.filter(c => c.read_status === false).length;
            setUnreadCount(count);
          }
        }).catch(() => {});
      }
    };

    fetchCounts();
    
    // Subscribe to cart changes
    const unsubCart = cartStore.subscribe(({ count }) => {
      setCartCount(count);
    });
    
    // Socket listeners for unread count
    const handleMsg = () => {
      if (!window.location.pathname.startsWith('/chat')) {
        setUnreadCount(prev => prev + 1);
      }
    };
    
    socketService.on('receive_message', handleMsg);
    socketService.on('messages_read', fetchCounts);

    return () => {
      unsubCart();
      socketService.off('receive_message', handleMsg);
      socketService.off('messages_read', fetchCounts);
    };
  }, [user?._id]);

  // Clear unread badge when viewing chat
  useEffect(() => {
    if (pathname?.startsWith('/chat')) setUnreadCount(0);
  }, [pathname]);

  // Hide on auth, admin, vendor, logistics, wallet, and full-screen chat pages
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/vendor') ||
    pathname?.startsWith('/logistics') ||
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
    <header className="sticky top-0 z-[500] bg-[var(--nav-bg)] border-b border-[var(--nav-border)] w-full transition-all duration-300">
      {/* iOS Dynamic Island / notch safe-area spacer */}
      <div className="w-full bg-[var(--nav-bg)]" style={{ height: 'env(safe-area-inset-top)' }} aria-hidden="true" />
      <div className="px-4 md:px-6 py-3 md:py-4 max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4 lg:gap-12 shrink-0">
          <Link href={user ? "/discovery?tab=discover" : "/"} className="flex items-center gap-2 md:gap-3 group">
            <img
              src="/icon-512.png"
              alt="Aura Market"
              className="h-6 md:h-7 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </Link>
        </div>
        
        {/* Global Search Interface - Icon Only */}
        {!hideSearchIcon && (
          <div className="hidden lg:flex flex-1 justify-end mr-4">
             <button 
               onClick={() => setIsSearchOpen(!isSearchOpen)}
               className="size-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-border)] hover:text-[var(--accent)] transition-all active:scale-95 shadow-sm group"
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
              className="lg:hidden size-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all active:scale-95 shadow-sm"
            >
              <Search className="size-5" />
            </button>
          )}

          <button 
            onClick={() => openChat(null)}
            className="relative size-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:text-[var(--accent)] transition-all text-[var(--text-primary)] active:scale-95 shadow-sm"
          >
            <MessageCircle className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] animate-pulse leading-none shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {user && (
            <Link 
              href="/wallet" 
              className="relative size-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:text-[var(--accent)] transition-all text-[var(--text-primary)] active:scale-95 shadow-sm"
              title="Wallet"
            >
              <Wallet className="size-5" />
            </Link>
          )}

          <div className="relative group/cart">
            <Link href="/cart" className="relative size-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:text-[var(--accent)] transition-all text-[var(--text-primary)] active:scale-95 shadow-sm">
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--accent)] text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] leading-none shadow-lg">
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
              href={user.role === 'admin' ? '/admin/dashboard' : user.role === 'logistics' ? '/logistics/dashboard' : user.role === 'vendor' ? '/vendor/dashboard' : '/profile'} 
              className="shrink-0"
            >
               <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-light)] p-0.5 shadow-xl shadow-[var(--accent)]/10 hover:scale-110 transition-all">
                 <div className="size-full bg-[var(--bg-primary)] rounded-full flex items-center justify-center overflow-hidden">
                    {user.branding?.logo || user.avatar ? (
                      <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt={user.name} />
                    ) : (
                      <span className="text-[var(--text-primary)] font-bold text-xs">{user.name?.[0]?.toUpperCase()}</span>
                    )}
                 </div>
               </div>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-full font-bold text-[10px] tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl shadow-[var(--accent)]/10 whitespace-nowrap active:scale-95">
              <UserIcon className="size-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>

      {/* Standardized Search Overlay */}
      {isSearchOpen && !hideSearchIcon && (
        <div className="absolute left-0 top-full w-full bg-[var(--nav-bg)] p-4 border-b border-[var(--glass-border)] animate-in slide-in-from-top-4 duration-500 shadow-2xl">
          <div className="relative w-full max-w-2xl mx-auto">
            <input 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search products, vendors, and management..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-3.5 pl-6 pr-14 text-sm text-[var(--text-primary)] font-bold focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all shadow-inner placeholder:opacity-30"
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
