"use client";

import { Menu, X, Bell, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/hooks/useAuth';

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const { unreadCount, unreadMessages } = useNotifications();

  return (
    <header className="lg:hidden h-14 flex items-center justify-between px-4 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] sticky top-0 z-[190] transition-colors duration-500">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all"
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <div className="flex items-center gap-2 min-w-0">
           <img 
             src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'} 
             alt="Aura" 
             className="h-4.5 w-auto shrink-0"
           />
           <h1 className="text-[11px] font-black tracking-tight text-[var(--text-primary)] uppercase leading-none truncate">
             Aura <span className="text-[var(--accent)]">Market</span>
           </h1>
        </div>
      </div>

      {/* Right-side icon row (notifications + messages) */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        {user && (
          <Link
            href="/notifications"
            id="dashboard-notification-bell"
            className="relative p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all"
            title="Notifications"
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-[var(--accent)] text-white text-[8px] font-black rounded-full flex items-center justify-center border border-[var(--bg-primary)] animate-pulse leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* Messages */}
        <Link
          href="/messages"
          id="dashboard-messages-icon"
          className="relative p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all"
          title="Messages"
        >
          <MessageCircle className="size-4.5" />
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-[var(--bg-primary)] animate-pulse leading-none">
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          )}
        </Link>

        {/* Role indicator pill */}
        <div className="size-7 rounded-lg bg-gradient-to-tr from-[var(--accent)]/15 to-indigo-600/10 border border-[var(--accent)]/15 flex items-center justify-center font-black text-[10px] text-[var(--accent)] shrink-0">A</div>
      </div>
    </header>
  );
}
