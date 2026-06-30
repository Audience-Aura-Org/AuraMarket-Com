"use client";
import React, { useState, useEffect } from 'react';
import { Menu, X, ShoppingCart, MessageCircle, User, Wallet } from 'lucide-react';
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
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link
            href={user ? "/shop" : "/"}
            className="flex min-w-0 max-w-[52vw] items-center gap-2 transition-transform active:scale-[0.98] sm:max-w-none"
          >
            {mounted && <img src="/icon-512.png" alt="Aura" className="h-[18px] w-auto shrink-0" />}
            <h1 className="truncate text-[11px] font-semibold leading-none tracking-tight text-[var(--nav-text)] lg:text-[12px]">
              Aura <span className="text-[var(--accent)]">Market</span>
            </h1>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Wallet */}
          {user && (
            <Link
              href="/wallet"
              className="relative flex h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
            >
              <Wallet className="size-4 shrink-0 text-[var(--accent)]" />
              <span className="max-w-[48px] truncate text-[10px] font-bold tabular-nums leading-none">
                {walletBalance === null ? '...' : walletBalance.toLocaleString()}
              </span>
            </Link>
          )}

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-[var(--accent)] px-0.5 text-[10px] font-semibold leading-none text-white shadow-sm lg:text-[12px] dark:border-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)]">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* Messages */}
          {user && (
            <button
              type="button"
              onClick={() => openChat(null, null, null, false)}
              aria-label="Messages"
              className={`relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))] ${chatOverlayOpen ? "ring-2 ring-[var(--accent)]/50 dark:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]" : ""}`}
            >
              <MessageCircle className="size-5" />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[var(--nav-bg)] bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white animate-pulse lg:text-[12px] dark:border-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)]">
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
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[var(--accent)] to-indigo-600 p-0.5 shadow-sm transition-all active:scale-[0.97] sm:size-10 relative z-[600] pointer-events-auto cursor-pointer"
          >
            <div className="size-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
              {user?.branding?.logo || user?.avatar ? (
                <img src={user?.branding?.logo || user?.avatar} className="size-full object-cover" alt="" />
              ) : (
                <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                  {user?.name?.[0] || 'U'}
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
