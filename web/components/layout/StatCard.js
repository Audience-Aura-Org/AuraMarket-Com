"use client";

import React from 'react';
import Link from 'next/link';

const colorMap = {
  emerald: {
    bg: 'bg-emerald-500/10', text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    bar: 'bg-emerald-500',
    footerText: 'text-emerald-600/80 dark:text-emerald-400/90',
    gradient: '#10b981',
  },
  primary: {
    bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]',
    border: 'border-[var(--accent)]/20',
    bar: 'bg-[var(--accent)]',
    footerText: 'text-[var(--accent)]/80',
    gradient: 'var(--accent)',
  },
  blue: {
    bg: 'bg-indigo-600/10', text: 'text-indigo-600',
    border: 'border-indigo-600/20',
    bar: 'bg-indigo-500',
    footerText: 'text-indigo-600/80 dark:text-indigo-400/90',
    gradient: '#4f46e5',
  },
  purple: {
    bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]',
    border: 'border-[var(--accent)]/20',
    bar: 'bg-[var(--accent)]',
    footerText: 'text-[var(--accent)]/80',
    gradient: 'var(--accent)',
  },
  amber: {
    bg: 'bg-amber-500/10', text: 'text-amber-600',
    border: 'border-amber-500/20',
    bar: 'bg-amber-500',
    footerText: 'text-amber-600/80 dark:text-amber-400/90',
    gradient: '#f59e0b',
  },
  rose: {
    bg: 'bg-rose-500/10', text: 'text-rose-600',
    border: 'border-rose-500/20',
    bar: 'bg-rose-500',
    footerText: 'text-rose-600/80 dark:text-rose-400/90',
    gradient: '#f43f5e',
  },
  indigo: {
    bg: 'bg-indigo-500/10', text: 'text-indigo-600',
    border: 'border-indigo-500/20',
    bar: 'bg-indigo-500',
    footerText: 'text-indigo-600/80 dark:text-indigo-400/90',
    gradient: '#6366f1',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600',
    border: 'border-fuchsia-500/20',
    bar: 'bg-fuchsia-500',
    footerText: 'text-fuchsia-600/80 dark:text-fuchsia-400/90',
    gradient: '#d946ef',
  },
};

export default function StatCard({ label, value, sub, icon: Icon, color = 'primary', pct, href, progress, footer, loading = false }) {
  const c = colorMap[color] || colorMap.primary;

  const content = (
    <div className="relative overflow-hidden glass-panel p-4 md:p-5 rounded-2xl md:rounded-[2rem] hover:-translate-y-1 transition-all duration-500 bg-[var(--bg-primary)]/70 backdrop-blur-xl border border-[var(--glass-border)] shadow-sm hover:shadow-xl group h-full flex flex-col gap-3">

      {/* Gradient overlay — matches dashboard cards */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl md:rounded-[2rem]"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${c.gradient} 6%, transparent) 0%, transparent 60%)` }}
      />

      {/* Top: Icon + optional percentage badge */}
      <div className="flex justify-between items-start">
        <div className={`size-8 md:size-10 rounded-xl md:rounded-2xl ${c.bg} flex items-center justify-center ${c.text} shadow-inner border ${c.border} shrink-0`}>
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

      {/* Content: label, value, sub */}
      <div>
        <p className="mb-0.5 text-[10px] font-medium capitalize tracking-wide text-[var(--text-secondary)] opacity-65">{label}</p>
        {loading ? (
          <>
            <div className="h-6 w-24 rounded-lg bg-[var(--bg-secondary)] animate-pulse mt-1" />
            <div className="h-3 w-16 rounded-md bg-[var(--bg-secondary)] animate-pulse mt-2" />
          </>
        ) : (
          <>
            <h3 className="truncate font-mono text-lg font-semibold tracking-tight text-[var(--text-primary)] md:text-2xl">{value}</h3>
            {sub && (
              <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-55">{sub}</p>
            )}
          </>
        )}
      </div>

      {/* Optional progress bar */}
      {progress != null && (
        <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-1000`}
            style={{ width: `${Math.min(Math.max(Number(progress) || 0, 0), 100)}%` }}
          />
        </div>
      )}

      {/* Optional colored footer text */}
      {footer && (
        <p className={`text-[10px] font-medium tracking-tight ${c.footerText}`}>{footer}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{content}</Link>;
  }

  return content;
}
