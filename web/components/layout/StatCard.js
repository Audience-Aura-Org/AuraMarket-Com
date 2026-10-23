"use client";

import React from 'react';
import Link from 'next/link';
import styles from './StatCard.module.css';

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

export default function StatCard({ label, value, sub, icon: Icon, color = 'primary', pct, href, progress, footer, loading = false, unit }) {
  const c = colorMap[color] || colorMap.primary;

  const content = (
    <div className={`${styles.card} relative overflow-hidden p-4 md:p-5 h-full min-w-0 flex flex-col gap-3`} aria-busy={loading || undefined}>

      {/* Gradient overlay — matches dashboard cards */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[2rem]"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${c.gradient} 6%, transparent) 0%, transparent 55%)` }}
      />

      {/* Top: Icon + optional percentage badge */}
      <div className="relative flex justify-between items-center gap-2">
        <div className={`size-10 rounded-2xl ${c.bg} flex items-center justify-center ${c.text} border ${c.border} shrink-0`}>
          {typeof Icon === 'string' ? (
            <span className="material-symbols-outlined text-xl" aria-hidden="true">{Icon}</span>
          ) : Icon ? (
            <Icon className="size-5" aria-hidden="true" />
          ) : null}
        </div>
        {pct && (
          <span className={`${styles.small} max-w-[48%] truncate text-right font-medium text-[var(--text-secondary)]`}>{pct}</span>
        )}
      </div>

      {/* Content: label, value, sub */}
      <div className="relative min-w-0">
        <p className={`${styles.label} font-medium text-[var(--text-secondary)] truncate`}>{label}</p>
        {loading ? (
          <>
            <div className="h-7 w-28 rounded-xl bg-[var(--bg-secondary)] animate-pulse mt-1" />
            <div className="h-3 w-16 rounded-md bg-[var(--bg-secondary)] animate-pulse mt-2" />
          </>
        ) : (
          <>
            <p className="mt-1 flex items-baseline gap-1.5 min-w-0"><span className={`${styles.value} truncate text-[var(--text-primary)] tabular-nums`}>{value}</span>{unit && <span className={`${styles.value} shrink-0 text-[var(--text-primary)]`}>{unit}</span>}</p>
            <p className={`${styles.small} mt-1 min-h-[1.5em] truncate font-medium text-[var(--text-secondary)]`} aria-hidden={!sub || undefined}>{sub || '\u00a0'}</p>
          </>
        )}
      </div>

      {/* Optional progress bar */}
      <div className="relative h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-1000`}
            style={{ width: `${Math.min(Math.max(Number(progress) || 0, 0), 100)}%` }}
          />
      </div>

      {/* Consistent footer space keeps dashboard metrics aligned. */}
      <p className={`${styles.small} relative min-h-[1.5em] font-medium ${c.footerText}`} aria-hidden={!footer || undefined}>{footer || '\u00a0'}</p>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full min-w-0 rounded-[2rem]">{content}</Link>;
  }

  return content;
}
