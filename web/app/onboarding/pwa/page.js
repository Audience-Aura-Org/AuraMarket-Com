'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  Smartphone, Share, PlusSquare, 
  ArrowLeft, Sparkles, DownloadCloud, CheckCircle,
  Download
} from 'lucide-react';

export default function PWAOnboarding() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col transition-colors duration-500">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-3xl px-6 py-6 flex items-center justify-between border-b border-[var(--glass-border)]">
        <button 
          onClick={() => router.back()} 
          className="size-11 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-all shadow-sm"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-[10px] font-black tracking-[0.3em] text-[var(--text-primary)] uppercase opacity-60">Installation Guide</h1>
        <div className="size-11 rounded-xl bg-[#0d0d0d] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
           <img src="/icon-192.png" className="size-full object-cover" alt="Aura Logo" />
        </div>
      </div>

      <main className="flex-1 max-w-lg mx-auto px-8 py-12 flex flex-col items-center text-center">
        {/* Friendly Hero */}
        <div className="relative mb-8">
           <div className="size-28 rounded-[2.5rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-[var(--accent)]/30 ring-8 ring-[var(--accent)]/10 animate-pulse">
              <DownloadCloud className="size-12" />
           </div>
           <div className="absolute -top-3 -right-3 size-9 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-xl">
              <Sparkles className="size-4" />
           </div>
        </div>

        <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-4 leading-tight">
          Get the Aura App
        </h2>
        <p className="text-[var(--text-secondary)] font-medium text-base mb-12 opacity-70 px-4">
          Enjoy the definitive Aura Market experience—faster, smoother, and right at your fingertips.
        </p>

        {/* Easy Step Cards */}
        <div className="w-full space-y-4">
          <div className="p-7 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-6 text-left group hover:border-[var(--accent)]/30 transition-all shadow-sm">
             <div className="size-11 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                <Share className="size-5 text-[var(--accent)]" />
             </div>
             <div>
                <h4 className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest mb-0.5">Step 01</h4>
                <p className="text-sm font-bold text-[var(--text-primary)]">Tap the <span className="text-[var(--accent)]">Share</span> button at the bottom of Safari.</p>
             </div>
          </div>

          <div className="p-7 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-6 text-left group hover:border-[var(--accent)]/30 transition-all shadow-sm">
             <div className="size-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <PlusSquare className="size-5 text-indigo-500" />
             </div>
             <div>
                <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Step 02</h4>
                <p className="text-sm font-bold text-[var(--text-primary)]">Select <span className="text-indigo-500">"Add to Home Screen"</span> from the list.</p>
             </div>
          </div>

          <div className="p-7 rounded-[2rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center gap-6 text-left text-white shadow-xl shadow-[var(--accent)]/20 border border-white/20 transition-all">
             <div className="size-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle className="size-5 text-white" />
             </div>
             <div>
                <h4 className="text-[9px] font-black text-white/70 uppercase tracking-widest mb-0.5">Step 03</h4>
                <p className="text-sm font-bold">You're all set! Open Aura from your home screen anytime.</p>
             </div>
          </div>
        </div>

        {/* Native Install CTA (visible for Android/Desktop) */}
        {isInstallable && (
          <button
            onClick={handleInstallClick}
            className="w-full mt-12 p-6 rounded-[2rem] bg-[var(--accent)] text-white flex items-center justify-center gap-3 shadow-2xl shadow-[var(--accent)]/30 hover:opacity-90 active:scale-[0.98] transition-all group"
          >
            <Download className="size-6 group-hover:bounce" />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">One-Tap Install</p>
              <p className="text-lg font-black leading-none">Install Aura Market</p>
            </div>
          </button>
        )}

        <div className="mt-16 py-6 px-6 border-t border-[var(--glass-border)] w-full opacity-30">
           <p className="text-[9px] font-black tracking-[0.4em] text-[var(--text-secondary)] uppercase flex items-center justify-center gap-3">
              <Smartphone className="size-3" /> Mobile Experience Ready <Smartphone className="size-3" />
           </p>
        </div>
      </main>
    </div>
  );
}
