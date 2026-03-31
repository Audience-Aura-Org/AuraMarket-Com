'use client';

import { useState, useEffect } from 'react';
import { Download, XCircle, Sparkles, Smartphone, Laptop, Zap } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let timerId;
    
    // Prevent showing if already installed standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Detect Device Type
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
    setIsDesktop(window.innerWidth > 1024);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        timerId = setTimeout(() => {
          setIsVisible(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIOSDevice) {
       const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
       if (!dismissed) {
         timerId = setTimeout(() => {
           setIsVisible(true);
         }, 3000);
       }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      alert('To install Aura Market:\n\n1. Tap the Share icon (square with an up arrow) at the bottom (iPhone) or top (iPad) of Safari.\n\n2. Scroll down and select "Add to Home Screen".');
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed z-[250] animate-in fade-in slide-in-from-bottom-12 duration-1000 ${isDesktop ? 'bottom-8 right-8 max-w-[420px]' : 'bottom-24 left-4 right-4'}`}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .aura-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite linear;
        }
      `}</style>

      <div className="relative group p-[1px] rounded-[2.5rem] overflow-hidden">
        {/* Animated Border Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/50 via-indigo-500/50 to-[var(--accent)]/50 blur-sm group-hover:opacity-100 transition-opacity" />
        
        <div className="relative h-full w-full bg-[var(--bg-primary)]/80 backdrop-blur-3xl rounded-[2.5rem] p-6 shadow-2xl flex items-center justify-between gap-5 border border-white/5">
          
          {/* Subtle Dynamic Backgrounds */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--accent)]/10 blur-[50px] rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full" />

          {/* Left Section: Identity */}
          <div className="flex items-center gap-4 relative">
             <div className="size-14 rounded-[1.25rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-[var(--accent)]/35 ring-1 ring-white/20 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                {isDesktop ? <Laptop className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
                <div className="absolute inset-0 aura-shimmer rounded-[1.25rem] opacity-30" />
             </div>
             <div>
                <h3 className="text-[11px] font-black text-[var(--accent)] tracking-[0.25em] uppercase mb-1 flex items-center gap-2">
                   Aura Node <Zap className="size-3 fill-[var(--accent)]" />
                </h3>
                <h2 className="text-sm font-black text-[var(--text-primary)] tracking-tight uppercase leading-none">
                   Install Experience
                </h2>
             </div>
          </div>

          {/* Right Section: Actions */}
          <div className="flex items-center gap-3 relative">
             <button 
                onClick={handleInstall}
                className="relative px-6 py-3 rounded-2xl bg-white dark:bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:shadow-[var(--accent)]/20 hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center gap-2 overflow-hidden group/btn"
             >
                <div className="absolute inset-0 aura-shimmer opacity-20" />
                <Download className="w-3.5 h-3.5 group-hover/btn:bounce transition-transform" /> 
                Add Now
             </button>
             <button 
                onClick={dismiss}
                className="p-3 rounded-2xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
             >
                <XCircle className="w-5 h-5" />
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}
