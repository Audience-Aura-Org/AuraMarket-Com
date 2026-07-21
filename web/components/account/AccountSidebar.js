"use client";

import { ChevronRight, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { TABS } from './constants';
import { useLanguage } from '@/context/LanguageContext';

export default function AccountSidebar({ activeTab, onTabChange }) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const filteredTabs = TABS.filter((tab) => tab.roles.includes(user?.role || 'customer'));

  const handleTabClick = (tabId) => {
    onTabChange?.(tabId);
  };

  return (
    <div className="lg:col-span-1">

      {/* ── Mobile: vertical card list ── */}
      <div className="flex flex-col gap-2 lg:hidden">
        {/* Theme toggle card */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)] transition-all active:scale-[0.98]"
        >
          <div className="size-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            {theme === 'dark'
              ? <Moon className="w-4 h-4 text-[var(--accent)]" />
              : <Sun className="w-4 h-4 text-[var(--accent)]" />}
          </div>
          <span className="flex-1 text-[13px] font-semibold text-[var(--text-primary)] text-left">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/40 shrink-0" />
        </button>

        {/* Nav tab cards */}
        {filteredTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-[var(--accent)] border-[var(--accent)] shadow-lg shadow-[var(--accent)]/25'
                  : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/60'
              }`}
            >
              <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                isActive ? 'bg-white/20' : 'bg-[var(--accent)]/10'
              }`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[var(--accent)]'}`} />
              </div>
              <span className={`flex-1 text-[13px] font-semibold text-left ${
                isActive ? 'text-white' : 'text-[var(--text-primary)]'
              }`}>
                {t(`tabs.${tab.id}`, tab.label)}
              </span>
              <ChevronRight className={`w-4 h-4 shrink-0 ${
                isActive ? 'text-white/60' : 'text-[var(--text-secondary)]/40'
              }`} />
            </button>
          );
        })}
      </div>

      {/* ── Desktop: sticky vertical card list ── */}
      <div className="hidden lg:block sticky top-4 space-y-1.5">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 hover:bg-[var(--bg-secondary)]/60 transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] group"
        >
          <div className="size-7 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--accent)]/20 transition-colors">
            {theme === 'dark'
              ? <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
              : <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />}
          </div>
          <span className="flex-1 text-[11px] font-semibold tracking-tight text-left">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 opacity-25 shrink-0" />
        </button>

        <nav className="space-y-1">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left group ${
                  isActive
                    ? 'bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/25'
                    : 'hover:bg-[var(--bg-secondary)]/60'
                }`}
              >
                <div className={`size-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isActive ? 'bg-white/20' : 'bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[var(--accent)]'}`} />
                </div>
                <span className={`flex-1 text-[11px] font-semibold tracking-tight ${
                  isActive ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}>
                  {t(`tabs.${tab.id}`, tab.label)}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-white/60' : 'opacity-20'
                }`} />
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
