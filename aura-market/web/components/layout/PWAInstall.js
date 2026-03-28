"use client";

import { useState, useEffect } from 'react';
import { Download, X, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Check if already installed or dismissed
      const isDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Fade in effect
    const timer = setTimeout(() => setIsMounting(false), 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
  };

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!isVisible || isMounting) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-10 md:w-[400px] z-[100] animate-in slide-in-from-bottom-10 fade-in duration-700">
      <div className="glass-panel p-6 rounded-[32px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
        {/* Ambient background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[var(--accent)]/20 transition-all duration-700" />
        
        <button onClick={dismiss} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-5 relative z-10">
          <div className="size-14 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/20 shrink-0">
            <Smartphone className="w-7 h-7" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-[var(--accent)] uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> System Update
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)] uppercase leading-tight">Install <span className="text-[var(--accent)]">Aura Terminal</span></h3>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 leading-relaxed uppercase tracking-wider">
              Optimize your marketplace frequency with instant access and native performance.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 relative z-10">
          <button 
            onClick={handleInstall}
            className="flex-1 py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-[10px] tracking-[0.2em] uppercase shadow-xl shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Initialize Install
          </button>
          <div className="px-4 py-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 opacity-40" />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
