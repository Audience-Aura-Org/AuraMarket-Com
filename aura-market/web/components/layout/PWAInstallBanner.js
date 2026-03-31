'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Sparkles } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let timerId;
    
    // 🛡️ HARDENED STANDALONE CHECK
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      return; 
    }

    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const desktopCheck = window.innerWidth > 1024;
    
    setIsIOS(isIOSDevice);
    setIsDesktop(desktopCheck);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        // Global Snap Delay: 3s
        timerId = setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIOSDevice) {
       const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
       if (!dismissed) {
         timerId = setTimeout(() => setIsVisible(true), 3000);
       }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleInstall = (e) => {
    e.stopPropagation();
    if (isIOS) {
       router.push('/onboarding/pwa');
       setIsVisible(false);
       return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismiss = (e) => {
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed z-[250] animate-in fade-in slide-in-from-bottom-10 h-16 duration-1000 ${isDesktop ? 'bottom-8 right-8 w-[28rem]' : 'bottom-24 left-0 right-0 px-5 max-w-lg mx-auto'}`}>
      
      {/* Branded "Exactly" Bar (v14.0) */}
      <div 
        onClick={handleInstall}
        className="group relative h-full w-full bg-[var(--bg-primary)]/95 backdrop-blur-3xl rounded-[2.5rem] border border-[var(--glass-border)] flex items-center justify-between pl-5 pr-4 cursor-pointer shadow-2xl hover:border-[var(--accent)]/30 transition-all active:scale-[0.98] overflow-hidden"
      >
        
        {/* Identity & Single Line Title */}
        <div className="flex items-center gap-4">
           <div className="size-11 rounded-2xl bg-black flex items-center justify-center p-2.5 shadow-lg shadow-[var(--accent)]/20 transform group-hover:rotate-6 transition-all ring-1 ring-white/10 shrink-0">
              <img src="/logo-white.png" alt="Aura Logo" className="size-full object-contain filter drop-shadow-[0_0_5px_var(--accent)]" />
           </div>
           {/* EXACTLY 16PX SINGLE LINE */}
           <h2 className="text-[16px] font-black text-[var(--text-primary)] tracking-tight uppercase leading-none font-[Poppins,system-ui] flex items-center gap-2 opacity-90 whitespace-nowrap">
              Install Mobile Hub <Sparkles className="size-4 text-[var(--accent)]" />
           </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
           <button 
              className="px-8 h-11 rounded-2xl bg-[var(--accent)] text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-[var(--accent)]/30 hover:bg-[var(--accent)]/90 flex items-center gap-2 transition-all active:scale-95 shrink-0"
           >
              <Download className="size-4" />
              Get Aura
           </button>
           <button 
             onClick={dismiss}
             className="px-2.5 h-11 rounded-2xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:text-white hover:bg-rose-500/20 transition-all opacity-40 hover:opacity-100 flex items-center justify-center border border-transparent hover:border-white/10 shrink-0"
           >
             <X className="size-5" />
           </button>
        </div>

        {/* Shimmer Base */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent w-full opacity-60 animate-[aura-shimmer_6s_infinite_linear]" />

      </div>

      <style jsx>{`
        @keyframes aura-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
