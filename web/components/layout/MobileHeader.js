"use client";
import React, { useState, useEffect } from 'react';
import { Menu, X, ShoppingCart, MessageCircle, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/hooks/useAuth';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useChat } from '@/context/ChatContext';
import cartStore from '@/services/cartStore';

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { user } = useAuthStore();
  const { walletBalance } = useWalletBalance();
  const { openChat, isOpen: chatOverlayOpen } = useChat();
  const { unreadMessages } = useNotifications();
  const [cartCount, setCartCount] = useState(cartStore.getCount());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?._id) {
      setCartCount(0);
      return;
    }

    const unsub = cartStore.subscribe(({ count }) => setCartCount(count));
    const refreshCart = () => cartStore.refresh();
    refreshCart();
    window.addEventListener('focus', refreshCart);
    document.addEventListener('visibilitychange', refreshCart);

    return () => {
      unsub();
      window.removeEventListener('focus', refreshCart);
      document.removeEventListener('visibilitychange', refreshCart);
    };
  }, [user?._id]);

  return (
    <header className="fixed inset-x-0 top-0 z-[500] w-full border-b border-[var(--nav-border)] bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors duration-300 dark:shadow-[0_10px_36px_-12px_rgba(0,0,0,0.12)] lg:hidden">
      {/* iOS Dynamic Island / notch safe-area spacer */}
      <div className="w-full shrink-0" style={{ height: "env(safe-area-inset-top)" }} aria-hidden="true" />
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--nav-btn-border)] bg-[var(--nav-btn-bg)] text-[var(--nav-btn-text)] shadow-sm transition-all hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] active:scale-95"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link
            href={user ? "/shop" : "/"}
            className="flex items-center gap-2 transition-transform active:scale-[0.98] group"
          >
            {mounted && <img src="/icon-512.png" alt="Auradime" className="h-6 w-auto shrink-0 object-contain transition-transform group-hover:scale-105" />}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Wallet */}
          {user && (
            <Link
              href={user.role === 'vendor' ? '/vendor/wallet' : user.role === 'logistics' ? '/logistics/wallet' : '/wallet'}
              className="relative inline-flex h-10 max-w-[112px] items-center gap-1.5 rounded-full border border-[var(--nav-btn-border)] bg-[var(--nav-btn-bg)] px-2.5 text-[10px] font-semibold text-[var(--nav-btn-text)] shadow-sm transition-all hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] active:scale-95 sm:max-w-none sm:gap-2 sm:px-3 sm:text-[11px]"
            >
              <Wallet className="size-3 shrink-0 text-[var(--accent)] sm:size-3.5" />
              <span className="min-w-0 truncate tabular-nums">{walletBalance === null ? '...' : walletBalance.toLocaleString()}</span>
              <span className="text-[9px] opacity-55">XAF</span>
            </Link>
          )}

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex size-10 items-center justify-center rounded-full border border-[var(--nav-btn-border)] bg-[var(--nav-btn-bg)] text-[var(--nav-btn-text)] shadow-sm transition-all hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] active:scale-95"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-[var(--accent)] px-0.5 text-[10px] font-semibold leading-none text-white shadow-sm lg:text-[12px] dark:border-[var(--nav-bg)]">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* Messages */}
          {user && (
            <button
              type="button"
              disabled={chatOverlayOpen}
              onClick={(e) => {
                if (chatOverlayOpen) {
                  e.preventDefault();
                  return;
                }
                openChat(null);
              }}
              aria-label="Messages"
              className={`relative flex size-10 items-center justify-center rounded-full border border-[var(--nav-btn-border)] bg-[var(--nav-btn-bg)] text-[var(--nav-btn-text)] shadow-sm transition-all hover:bg-[var(--accent)]/15 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] active:scale-95 ${chatOverlayOpen ? "ring-2 ring-[var(--accent)]/50 pointer-events-none opacity-80" : ""}`}
            >
              <MessageCircle className="size-5" />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white animate-pulse lg:text-[12px] dark:border-[var(--nav-bg)]">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </button>
          )}

          {/* User Profile / Logo */}
          <Link
            href={
              user?.role === "admin"
                ? "/admin/dashboard"
                : user?.role === "logistics"
                  ? "/logistics/dashboard"
                  : "/profile"
            }
            className="shrink-0 relative z-[600] pointer-events-auto cursor-pointer block"
          >
            <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-light)] p-0.5 shadow-xl shadow-[var(--accent)]/10 hover:scale-110 transition-all">
              <div className="size-full rounded-full bg-[var(--nav-bg)] flex items-center justify-center overflow-hidden">
                {user?.branding?.logo || user?.avatar ? (
                  <img src={user?.branding?.logo || user?.avatar} className="size-full object-cover" alt={user?.name} />
                ) : (
                  <span className="text-[11px] font-bold text-[var(--nav-btn-text)]">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
