'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center bg-[var(--bg-primary)]">
      <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
        <AlertTriangle className="size-7 text-amber-500" />
      </div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight font-[Poppins] mb-2">
        Something went wrong
      </h2>
      <p className="text-[13px] text-[var(--text-secondary)] max-w-sm leading-relaxed mb-8">
        We&apos;re experiencing a temporary issue. Our team has been notified and is working on it.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold shadow-md shadow-[var(--accent)]/20 hover:brightness-105 active:scale-95 transition-all"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
        <a
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] text-[12px] font-bold hover:text-[var(--text-primary)] active:scale-95 transition-all"
        >
          <Home className="size-3.5" />
          Go home
        </a>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-8">
        If this persists, contact support at hello@auradime.com
      </p>
    </div>
  );
}
