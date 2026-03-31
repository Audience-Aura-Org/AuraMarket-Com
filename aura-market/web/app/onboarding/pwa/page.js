'use client';

import { useRouter } from 'next/navigation';
import { 
  Smartphone, Share, PlusSquare, 
  ArrowLeft, Zap, Sparkles, DownloadCloud 
} from 'lucide-react';

export default function PWAOnboarding() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col transition-colors duration-500">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-3xl px-8 py-8 flex items-center justify-between border-b border-[var(--glass-border)]">
        <button 
          onClick={() => router.back()} 
          className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--nav-text)] hover:border-[var(--accent)]/50 transition-all shadow-sm"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="text-sm font-black tracking-[0.3em] text-[var(--text-primary)] uppercase">Deployment Hub</h1>
        <div className="size-12 opacity-0" />
      </div>

      <main className="flex-1 max-w-lg mx-auto px-8 py-16 flex flex-col items-center text-center">
        {/* Device Icon */}
        <div className="relative mb-12">
           <div className="size-32 rounded-[2.5rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-[var(--accent)]/30 ring-8 ring-[var(--accent)]/10 animate-pulse">
              <DownloadCloud className="size-14" />
           </div>
           <div className="absolute -top-4 -right-4 size-10 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-xl">
              <Zap className="size-5 fill-[var(--accent)]" />
           </div>
        </div>

        <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-4 leading-tight">
          Aura Node Standalone
        </h2>
        <p className="text-[var(--text-secondary)] font-medium text-lg mb-16 opacity-60">
          Sync Aura Market directly to your system for the definitive desktop and mobile experience.
        </p>

        {/* Instruction Cards */}
        <div className="w-full space-y-6">
          <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-start gap-6 text-left group hover:border-[var(--accent)]/30 transition-all">
             <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                <Share className="size-6 text-[var(--accent)]" />
             </div>
             <div>
                <h4 className="text-xs font-black text-[var(--accent)] uppercase tracking-widest mb-1">Step 01</h4>
                <p className="text-base font-bold text-[var(--text-primary)]">Tap the <span className="text-[var(--accent)]">Share</span> icon in Safari's bottom toolbar.</p>
             </div>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-start gap-6 text-left group hover:border-[var(--accent)]/30 transition-all">
             <div className="size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <PlusSquare className="size-6 text-indigo-500" />
             </div>
             <div>
                <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">Step 02</h4>
                <p className="text-base font-bold text-[var(--text-primary)]">Scroll down and select <span className="text-indigo-500">"Add to Home Screen"</span>.</p>
             </div>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-start gap-6 text-left text-white shadow-xl shadow-[var(--accent)]/20 border border-white/20 transition-all">
             <div className="size-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Smartphone className="size-6 text-white" />
             </div>
             <div>
                <h4 className="text-xs font-black text-white/70 uppercase tracking-widest mb-1">Step 03</h4>
                <p className="text-base font-bold">Launch Aura directly from your home screen as a standalone app.</p>
             </div>
          </div>
        </div>

        <div className="mt-20 py-8 px-6 border-t border-[var(--glass-border)] w-full opacity-40">
           <p className="text-[10px] font-black tracking-[0.4em] text-[var(--text-secondary)] uppercase flex items-center justify-center gap-3">
              <Sparkles className="size-3" /> Liquid Sync Ready <Sparkles className="size-3" />
           </p>
        </div>
      </main>
    </div>
  );
}
