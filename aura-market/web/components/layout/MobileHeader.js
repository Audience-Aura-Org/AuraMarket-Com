"use client";

import { Menu, X, User } from 'lucide-react';
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from '@/hooks/useAuth';

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { theme } = useTheme();
  const { user } = useAuthStore();

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

      <div className="size-8 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden flex items-center justify-center font-black text-[10px] text-[var(--accent)] shrink-0">
        {user?.branding?.logo || user?.avatar ? (
          <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt="" />
        ) : (
          <User className="size-4 opacity-40 text-[var(--text-secondary)]" />
        )}
      </div>
    </header>
  );
}
