"use client";

import { Menu, X } from 'lucide-react';
import { useTheme } from "@/context/ThemeContext";

export default function MobileHeader({ isOpen, toggleSidebar }) {
  const { theme } = useTheme();

  return (
    <header className="lg:hidden h-16 flex items-center justify-between px-6 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] sticky top-0 z-[80] transition-colors duration-500">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all"
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <div className="flex items-center gap-2">
           <img 
             src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'} 
             alt="Aura" 
             className="h-5 w-auto"
           />
           <h1 className="text-xs font-black tracking-tighter text-[var(--text-primary)] uppercase leading-none">
             Aura <span className="text-[var(--accent)]">Market</span>
           </h1>
        </div>
      </div>
      
      <div className="size-8 rounded-lg bg-gradient-to-tr from-[var(--accent)]/20 to-indigo-600/10 border border-[var(--accent)]/20 flex items-center justify-center font-black text-[10px] text-[var(--accent)]">
        A
      </div>
    </header>
  );
}
