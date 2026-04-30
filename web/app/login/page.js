"use client";

import Link from 'next/link';
import UnifiedAuth from '@/components/auth/UnifiedAuth';

export default function LoginPage() {
  return (
    <div className="bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animation-delay-2000 pointer-events-none"></div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6 bg-transparent">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/icon-512.png"
            alt="Aura Market"
            className="h-10 w-auto object-contain group-hover:scale-110 transition-transform"
          />
          <h1 className="text-xl font-black tracking-tighter text-[var(--text-primary)]">
            Aura<span className="text-[var(--accent)]">Market</span>
          </h1>
        </Link>
      </header>
      
      {/* Unified Auth Hub */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <UnifiedAuth />
      </main>

      {/* Simplified Footer */}
      <footer className="px-6 py-8 border-t border-[var(--glass-border)]/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/terms" className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">Terms</Link>
          <Link href="/privacy" className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">Privacy</Link>
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
          {/* Identity Metadata Removed */}
        </p>
      </footer>
    </div>
  );
}
