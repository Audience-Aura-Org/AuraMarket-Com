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
        <h1 className="text-[11px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-primary)]  opacity-60">Installation Guide</h1>
        <div className="size-11 rounded-full bg-[#0d0d0d] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
           <img src="/icon-512.png?v=8" className="w-10 h-auto" alt="Aura Logo" />
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tighter  mb-4 leading-tight">
            Elevate your experience
          </h2>
          <p className="text-[var(--text-secondary)] font-medium text-base md:text-lg opacity-70 px-4">
            Install Aura for a faster, smoother, and completely native marketplace journey.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* LEFT SECTION: Android & Desktop */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <h3 className="text-[11px] lg:text-[12px] font-bold  tracking-[0.4em] text-[var(--accent)]">Android & Desktop</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-[var(--accent)]/20 to-transparent" />
            </div>

            <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl relative overflow-hidden group hover:border-[var(--accent)]/30 transition-all duration-500">
               <div className="absolute top-0 right-0 size-32 bg-[var(--accent)]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--accent)]/10 transition-all" />
               
               <div className="relative z-10 space-y-8">
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">One-Tap Install</h4>
                    <p className="text-xs font-medium text-[var(--text-secondary)] opacity-60">Instant synchronization with your operating system.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center shrink-0 text-[11px] lg:text-[12px] font-bold text-[var(--accent)]">01</div>
                      <p className="text-sm font-bold text-[var(--text-primary)] pt-1.5">Launch Aura in Chrome, Edge, or Brave.</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center shrink-0 text-[11px] lg:text-[12px] font-bold text-[var(--accent)]">02</div>
                      <p className="text-sm font-bold text-[var(--text-primary)] pt-1.5">Click the "Install" button or check the browser menu.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleInstallClick}
                    className={`w-full p-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all group/btn ${isInstallable ? 'bg-[var(--accent)] text-white shadow-[var(--accent)]/30 hover:opacity-90 active:scale-95' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40'}`}
                  >
                    <Download className={`size-5 ${isInstallable ? 'group-hover/btn:bounce' : 'opacity-40'}`} />
                    <span className="text-sm font-bold tracking-tight">Install Aura Now</span>
                  </button>

                  {!isInstallable ? (
                    <div className="p-5 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-center animate-in fade-in slide-in-from-top-2 duration-700">
                      <p className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--accent)] mb-1">Status: Ready for Sync</p>
                      <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60">If the automatic prompt doesn't appear, tap the <span className="font-bold text-[var(--text-primary)]">Browser Menu (⋮ or ≡)</span> and select <span className="font-bold text-[var(--text-primary)]">"Install App"</span>.</p>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center animate-in fade-in zoom-in duration-500">
                      <p className="text-[11px] lg:text-[12px] font-bold tracking-tight text-emerald-500">Native Signal Detected</p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* RIGHT SECTION: iOS Manual Setup */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <h3 className="text-[11px] lg:text-[12px] font-bold  tracking-[0.4em] opacity-40">iOS / Manual Guide</h3>
              <div className="h-px flex-1 bg-[var(--glass-border)]" />
            </div>

            <div className="space-y-4">
              <div className="p-7 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-6 text-left group hover:border-[var(--accent)]/30 transition-all shadow-sm">
                 <div className="size-11 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                    <Share className="size-5 text-[var(--accent)]" />
                 </div>
                 <div>
                    <h4 className="text-[11px] lg:text-[12px] font-bold text-[var(--accent)] tracking-tight mb-0.5">Safari Share</h4>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Tap the <span className="text-[var(--accent)]">Share</span> button at the bottom.</p>
                 </div>
              </div>

              <div className="p-7 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-6 text-left group hover:border-[var(--accent)]/30 transition-all shadow-sm">
                 <div className="size-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <PlusSquare className="size-5 text-indigo-500" />
                 </div>
                 <div>
                    <h4 className="text-[11px] lg:text-[12px] font-bold text-indigo-500 tracking-tight mb-0.5">Add to Home</h4>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Select <span className="text-indigo-500">"Add to Home Screen"</span>.</p>
                 </div>
              </div>

              <div className="p-7 rounded-[2rem] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center gap-6 text-left shadow-sm">
                 <div className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="size-5 text-emerald-500" />
                 </div>
                 <div>
                    <h4 className="text-[11px] lg:text-[12px] font-bold text-emerald-500 tracking-tight mb-0.5">Launch</h4>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Open Aura from your home screen anytime.</p>
                 </div>
              </div>
            </div>
          </div>
        </div>


      </main>
    </div>
  );
}
