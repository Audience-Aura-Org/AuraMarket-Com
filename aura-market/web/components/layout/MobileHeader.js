"use client";

import { Menu, X, Bell, MessageCircle, User } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/hooks/useAuth';

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const { unreadCount, unreadMessages } = useNotifications();

  return (
    <header className="lg:hidden bg-[var(--nav-bg)] border-b border-[var(--nav-border)] text-[var(--nav-text)] sticky top-0 z-[300] transition-colors duration-500">
      {/* iOS Dynamic Island / notch safe-area spacer */}
      <div style={{ height: 'env(safe-area-inset-top)' }} aria-hidden="true" />
      <div className="h-14 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--nav-text)] hover:text-[var(--accent)] transition-all active:scale-95"
        >
          {isOpen ? <X className="size-5.5" /> : <Menu className="size-5.5" />}
        </button>
        <div className="flex items-center gap-2 min-w-0">
           <img 
             src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'} 
             alt="Aura" 
             className="h-4.5 w-auto shrink-0"
           />
           <h1 className="text-[11px] font-black tracking-tight text-[var(--nav-text)] uppercase leading-none truncate">
             Aura <span className="text-[var(--accent)]">Market</span>
           </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        {user && (
          <Link
            href="/notifications"
            className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--nav-text)] hover:text-[var(--accent)] transition-all active:scale-95"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-[var(--accent)] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] animate-pulse leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* Messages */}
        {user && (
          <Link
            href="/messages"
            className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--nav-text)] hover:text-[var(--accent)] transition-all active:scale-95"
          >
            <MessageCircle className="size-5" />
            {unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[var(--nav-bg)] animate-pulse leading-none">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </Link>
        )}

        {/* User Profile / Logo */}
        <div className="size-8 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden flex items-center justify-center shrink-0">
          {user?.branding?.logo || user?.avatar ? (
            <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt="" />
          ) : (
            <User className="size-4 opacity-40 text-[var(--text-secondary)]" />
          )}
        </div>
      </div>
      </div>{/* end h-14 row */}
    </header>
  );
}
