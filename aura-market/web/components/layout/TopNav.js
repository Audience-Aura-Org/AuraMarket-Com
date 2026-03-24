"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from '@/hooks/useAuth';
import { ShoppingCart, Search, User as UserIcon, LayoutGrid, Sparkles, Moon, Sun, MessageCircle } from 'lucide-react';
import { useTheme } from "@/context/ThemeContext";
import { trackSearch } from "@/services/tracking";
import api from '@/services/api';
import socketService from '@/services/socket';
import dynamic from 'next/dynamic';

const CartPreview = dynamic(() => import('@/components/CartPreview'), { ssr: false });

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  // ─── Fetch initial cart count ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;
    const fetchCounts = () => {
      api.get('/cart').then(res => {
        if (res.data?.success) {
          const items = res.data.data.cart?.items || [];
          setCartCount(items.reduce((s, i) => s + (i.quantity || 1), 0));
        }
      }).catch(() => {});
      
      api.get('/chat').then(res => {
        if (res.data?.success) {
          const count = res.data.data.activeChats.filter(c => c.read_status === false).length;
          setUnreadCount(count);
        }
      }).catch(() => {});
    };

    fetchCounts();
    
    // Listen for events that change counts
    const handleUpdate = (e) => {
      if (e.detail?.cart) {
        const items = e.detail.cart.items || [];
        setCartCount(items.reduce((s, i) => s + (i.quantity || 1), 0));
      } else {
        fetchCounts();
      }
    };
    window.addEventListener('cart-updated', handleUpdate);
    
    // Socket listeners for unread count
    const handleMsg = () => {
      if (!window.location.pathname.startsWith('/chat')) {
        setUnreadCount(prev => prev + 1);
      }
    };
    
    socketService.on('receive_message', handleMsg);
    socketService.on('messages_read', handleUpdate);

    return () => {
      window.removeEventListener('cart-updated', handleUpdate);
      socketService.off('receive_message', handleMsg);
      socketService.off('messages_read', handleUpdate);
    };
  }, [user?._id]);

  // Clear unread badge when viewing chat
  useEffect(() => {
    if (pathname?.startsWith('/chat')) setUnreadCount(0);
  }, [pathname]);

  // Hide on auth, admin, vendor, logistics pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/vendor') || pathname?.startsWith('/logistics') || pathname === '/login' || pathname === '/register') return null;

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      trackSearch(search);
      router.push(`/shop?q=${search}`);
      setIsSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--nav-bg)] border-b border-[var(--nav-border)] px-4 md:px-6 py-3 md:py-4 w-full transition-all duration-300">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4 lg:gap-12 shrink-0">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="size-8 md:size-10 bg-[var(--accent)] rounded-full flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 group-hover:scale-110 transition-transform">
              <Sparkles className="size-4 md:size-5" />
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter text-[var(--nav-text)] whitespace-nowrap">
              Aura<span className="text-[var(--accent)]">Market</span>
            </h1>
          </Link>
          
          <nav className="hidden xl:flex items-center gap-8">
            <Link href="/shop" className={`text-[10px] font-black tracking-[0.2em] hover:text-[var(--accent)] transition-colors uppercase ${pathname === '/shop' ? 'text-[var(--accent)]' : 'text-[var(--nav-text)]'}`}>Shop</Link>
            <Link href="/stores" className={`text-[10px] font-black tracking-[0.2em] hover:text-[var(--accent)] transition-colors uppercase ${pathname === '/stores' ? 'text-[var(--accent)]' : 'text-[var(--nav-text)]'}`}>Stores</Link>
            <Link href="/discovery" className={`text-[10px] font-black tracking-[0.2em] hover:text-[var(--accent)] transition-colors uppercase ${pathname === '/discovery' ? 'text-[var(--accent)]' : 'text-[var(--nav-text)]'}`}>Discovery</Link>
          </nav>
        </div>
        
        {/* Search Bar - Desktop */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4 relative group">
          <div className="w-full flex items-center bg-white/5 rounded-2xl px-4 py-2 border border-white/10 focus-within:border-[var(--accent)]/50 focus-within:bg-white/10 transition-all">
            <Search className="text-[var(--nav-text)]/40 size-4 group-focus-within:text-[var(--accent)] transition-colors" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              className="bg-transparent border-none focus:ring-0 text-[var(--nav-text)] text-xs w-full placeholder:text-[var(--nav-text)]/30 outline-none pl-3 font-bold" 
              placeholder="Search premium nodes..." 
              type="text"
            />
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 md:gap-4 ml-auto">
          {/* Mobile Search Toggle */}
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-[var(--nav-text)] hover:bg-[var(--accent)]/10 transition-all"
          >
            <Search className="size-5" />
          </button>

          <button 
            onClick={toggleTheme}
            className="hidden sm:flex p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-[var(--accent)]/10 transition-all text-[var(--nav-text)]"
          >
            {theme === 'light' ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </button>
          
          <Link href="/chat" className="relative p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-[var(--accent)]/10 transition-all text-[var(--nav-text)]">
            <MessageCircle className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] animate-pulse leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <div className="relative group/cart">
            <Link href="/cart" className="relative p-2 md:p-2.5 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-[var(--accent)]/10 transition-all text-[var(--nav-text)]">
              <ShoppingCart className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--accent)] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] leading-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            <div className="absolute right-0 mt-3 w-80 z-50 hidden md:block opacity-0 pointer-events-none group-hover/cart:opacity-100 group-hover/cart:pointer-events-auto transition-all">
              <CartPreview />
            </div>
          </div>
          
          {user ? (
            <Link href="/profile" className="shrink-0">
               <div className="size-8 md:size-10 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-light)] p-0.5 shadow-lg shadow-[var(--accent)]/20 hover:scale-105 transition-all">
                 <div className="size-full bg-[var(--bg-primary)] rounded-[10px] flex items-center justify-center overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} className="size-full object-cover" alt={user.name} />
                    ) : (
                      <span className="text-[var(--text-primary)] font-black text-[10px] md:text-xs">{user.name?.[0]?.toUpperCase()}</span>
                    )}
                 </div>
               </div>
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[10px] tracking-widest hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20 whitespace-nowrap">
              <UserIcon className="size-3" />
              <span className="hidden xs:inline">LOGIN</span>
              <span className="xs:hidden">IN</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="md:hidden absolute left-0 top-full w-full bg-[var(--nav-bg)] p-4 border-b border-[var(--nav-border)] animate-in slide-in-from-top duration-300">
          <div className="relative w-full">
            <input 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search Aura Nodes..."
              className="w-full bg-white/5 border border-[var(--accent)]/50 rounded-xl py-3 pl-4 pr-12 text-sm text-[var(--nav-text)] font-bold outline-none"
            />
            <button onClick={() => { trackSearch(search); router.push(`/shop?q=${search}`); setIsSearchOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--accent)]">
              <Search className="size-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

