'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Sparkles } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let timerId;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
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
    <div className="fixed z-[250] animate-in fade-in slide-in-from-bottom-10 duration-1000 bottom-24 left-0 right-0 px-5 max-w-lg mx-auto md:max-w-xl">
      
      {/* Branded Condensed Poppins Bar */}
      <div 
        onClick={handleInstall}
        className="group relative h-16 w-full bg-[var(--bg-primary)]/95 backdrop-blur-3xl rounded-[2rem] border border-[var(--glass-border)] flex items-center justify-between pl-5 pr-4 cursor-pointer shadow-2xl hover:border-[var(--accent)]/30 transition-all active:scale-[0.98] overflow-hidden"
      >
        
        {/* Branded Identity Section */}
        <div className="flex items-center gap-4">
           {/* Official logo icon container */}
           <div className="size-11 rounded-2xl bg-black flex items-center justify-center p-2.5 shadow-lg shadow-[var(--accent)]/20 transform group-hover:scale-105 group-hover:rotate-6 transition-all duration-500 ring-1 ring-white/10">
              <img src="/logo-white.png" alt="Aura Logo" className="size-full object-contain filter drop-shadow-[0_0_5px_var(--accent)]" />
           </div>
           <div className="flex flex-col">
              <h4 className="text-[9px] font-black tracking-[0.2em] text-[var(--accent)] uppercase mb-0.5 leading-none opacity-80 group-hover:opacity-100 transition-opacity">Aura Native</h4>
              <h2 className="text-[10px] font-black text-[var(--text-primary)] tracking-tight uppercase leading-none font-[Poppins,system-ui] flex items-center gap-1.5 opacity-90">
                 Install Mobile App <Sparkles className="size-2.5 text-[var(--accent)]" />
              </h2>
           </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
           <button 
              className="px-6 h-10 rounded-xl bg-[var(--accent)] text-white font-black text-[9px] uppercase tracking-widest shadow-xl shadow-[var(--accent)]/25 hover:bg-[var(--accent)]/90 flex items-center gap-2 transition-all active:scale-95"
           >
              <Download className="size-3" />
              Get Aura
           </button>
           <button 
             onClick={dismiss}
             className="px-2.5 h-10 rounded-xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:text-white hover:bg-rose-500/20 transition-all opacity-40 hover:opacity-100 flex items-center justify-center"
           >
             <X className="size-4" />
           </button>
        </div>

        {/* Liquid Shimmer Effect Layer */}
        <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent w-full opacity-60 animate-[aura-shimmer_3s_infinite_linear]" />

      </div>

      <style jsx>{`
        @keyframes aura-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
