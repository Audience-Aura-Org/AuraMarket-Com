"use client";
import React, { useState, useEffect } from 'react';
import { Menu, X, ShoppingCart, MessageCircle, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { user } = useAuthStore();
  const { openChat, isOpen: chatOverlayOpen } = useChat();
  const { unreadMessages } = useNotifications();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-[500] w-full border-b border-[var(--nav-border)] bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors duration-300 dark:shadow-[0_10px_36px_-12px_rgba(0,0,0,0.12)] lg:hidden">
      {/* iOS Dynamic Island / notch safe-area spacer */}
      <div className="w-full shrink-0" style={{ height: "env(safe-area-inset-top)" }} aria-hidden="true" />
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2.5 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
          >
            {isOpen ? <X className="size-[22px]" /> : <Menu className="size-[22px]" />}
          </button>
          <Link
            href={user ? "/discovery?tab=discover" : "/"}
            className="flex min-w-0 max-w-[52vw] items-center gap-2 transition-transform active:scale-[0.98] sm:max-w-none"
          >
            {mounted && <img src="/icon-512.png" alt="Aura" className="h-[18px] w-auto shrink-0" />}
            <h1 className="truncate text-[11px] font-semibold leading-none tracking-tight text-[var(--nav-text)] lg:text-[12px]">
              Aura <span className="text-[var(--accent)]">Market</span>
            </h1>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2.5 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
          >
            <ShoppingCart className="size-[22px]" />
          </Link>

          {/* Wallet */}
          {user && (
            <Link
              href="/wallet"
              className="relative flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2.5 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))]"
            >
              <Wallet className="size-[22px]" />
            </Link>
          )}

          {/* Messages */}
          {user && (
            <button
              type="button"
              onClick={() => openChat(null, null, null, false)}
              aria-label="Messages"
              className={`relative flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2.5 text-[var(--nav-text)] shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_92%,transparent)] dark:text-[var(--text-primary)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] dark:hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-secondary))] ${chatOverlayOpen ? "ring-2 ring-[var(--accent)]/50 dark:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]" : ""}`}
            >
              <MessageCircle className="size-[22px]" />
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
                  : user?.role === "vendor"
                    ? "/vendor/dashboard"
                    : "/profile"
            }
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--accent)_45%,white)] active:scale-[0.97] dark:border-[var(--glass-border)] dark:bg-[color-mix(in_srgb,var(--bg-secondary)_88%,transparent)] dark:hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--glass-border))] sm:size-10"
          >
            {user?.branding?.logo || user?.avatar ? (
              <img src={user?.branding?.logo || user?.avatar} className="size-full object-cover" alt="" />
            ) : (
              <User className="size-4 text-white/75 dark:text-[var(--text-secondary)]" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
