"use client";

import React from 'react';
import Link from 'next/link';

const colorMap = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-600', glow: '#10b981' },
  primary: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', badgeBg: 'bg-[var(--accent)]/10', badgeText: 'text-[var(--accent)]', glow: 'var(--accent)' },
  blue: { bg: 'bg-indigo-600/10', text: 'text-indigo-600', badgeBg: 'bg-indigo-600/10', badgeText: 'text-indigo-600', glow: '#4f46e5' },
  purple: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', badgeBg: 'bg-[var(--accent)]/10', badgeText: 'text-[var(--accent)]', glow: 'var(--accent)' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', badgeBg: 'bg-amber-500/10', badgeText: 'text-amber-600', glow: '#f59e0b' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600', badgeBg: 'bg-rose-500/10', badgeText: 'text-rose-600', glow: '#f43f5e' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', badgeBg: 'bg-indigo-500/10', badgeText: 'text-indigo-600', glow: '#6366f1' },
  fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600', badgeBg: 'bg-fuchsia-500/10', badgeText: 'text-fuchsia-600', glow: '#d946ef' },
};

export default function StatCard({ label, value, sub, icon: Icon, color = 'primary', pct, href }) {
  const c = colorMap[color] || colorMap.primary;
  
  const content = (
    <div className="glass-panel p-4 md:p-5 rounded-2xl md:rounded-[2rem] hover:-translate-y-1 transition-all duration-500 bg-[var(--bg-primary)]/60 border border-[var(--glass-border)] shadow-sm hover:shadow-xl group h-full flex flex-col justify-between">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <div className={`size-8 md:size-10 rounded-xl md:rounded-2xl ${c.bg} flex items-center justify-center ${c.text} shadow-inner`}>
          {typeof Icon === 'string' ? (
            <span className="material-symbols-outlined text-lg md:text-xl group-hover:scale-110 transition-transform">{Icon}</span>
          ) : Icon ? (
            <Icon className="size-4 md:size-5 group-hover:scale-110 transition-transform" />
          ) : null}
        </div>
        {pct && (
          <span className="max-w-[48%] truncate text-right text-[10px] font-medium text-[var(--text-secondary)] opacity-65 tracking-wide">{pct}</span>
        )}
      </div>
      <div>
        <p className="mb-0.5 text-[10px] font-medium capitalize tracking-wide text-[var(--text-secondary)] opacity-65">{label}</p>
        <h3 className="truncate font-mono text-lg font-semibold tracking-tight text-[var(--text-primary)] md:text-2xl">{value}</h3>
        {sub && (
          <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-55">{sub}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{content}</Link>;
  }

  return content;
}
