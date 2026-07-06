"use client";

import { Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { TABS } from './constants';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function AccountSidebar({ activeTab, onTabChange }) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const filteredTabs = TABS.filter((t) => t.roles.includes(user?.role || 'customer'));

  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      router.push(`/profile?tab=${tabId}`);
    }
  };

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-[160px] space-y-1.5">
        {/* Theme toggle chip */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 hover:bg-[var(--bg-secondary)]/60 transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] group"
        >
          <div className="size-7 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--accent)]/20 transition-colors">
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[var(--accent)]" />
            )}
          </div>
          <span className="text-[11px] font-semibold tracking-tight">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>

        {/* Navigation */}
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
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25'
                    : 'hover:bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className={`size-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-white/20'
                    : 'bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[var(--accent)]'}`} />
                </div>
                <span className="text-[11px] font-semibold tracking-tight">{t(`tabs.${tab.id}`, tab.label)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
