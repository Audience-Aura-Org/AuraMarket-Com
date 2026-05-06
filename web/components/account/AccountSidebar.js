"use client";

import { User, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { TABS } from './constants';
import { useRouter } from 'next/navigation';

export default function AccountSidebar({ activeTab, onTabChange }) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
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
      <div className="sticky top-24 space-y-6">
        {/* Profile Card */}
        <div className="bg-gradient-to-br from-[var(--bg-secondary)]/30 to-transparent border border-[var(--glass-border)] rounded-[3rem] p-6 backdrop-blur-3xl shadow-xl transition-all duration-500 hover:shadow-2xl space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[2rem] overflow-hidden border border-[var(--glass-border)] bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
              {(user?.branding?.logo || user?.avatar) ? (
                <img src={user?.branding?.logo || user?.avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <User className="w-6 h-6 text-[var(--accent)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-[var(--text-secondary)] capitalize truncate">{user?.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="flex-1 p-2 rounded-[1.5rem] bg-[var(--bg-secondary)]/50 hover:bg-[var(--glass-border)] transition-colors flex items-center justify-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[1.5rem] transition-all text-left ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                    : 'hover:bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[var(--accent)]'}`} />
                <span className="text-[11px] lg:text-[12px] font-bold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
