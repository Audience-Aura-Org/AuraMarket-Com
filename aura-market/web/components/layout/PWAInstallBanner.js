'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Smartphone, Laptop, Sparkles } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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
    setIsDesktop(window.innerWidth > 1024);

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
    <div className={`fixed z-[250] animate-in fade-in slide-in-from-bottom-10 duration-1000 ${isDesktop ? 'bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8' : 'bottom-24 left-0 right-0 px-5'}`}>
      
      {/* Condensed Poppins Rounded Bar */}
      <div 
        onClick={handleInstall}
        className="group relative h-16 w-full bg-[var(--bg-primary)]/95 backdrop-blur-3xl rounded-[2rem] border border-[var(--glass-border)] flex items-center justify-between pl-6 pr-4 cursor-pointer shadow-2xl hover:border-[var(--accent)]/30 transition-all active:scale-[0.98]"
      >
        
        {/* Identity Section */}
        <div className="flex items-center gap-4">
           <div className="size-10 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 transform group-hover:scale-110 transition-all duration-500">
              {isDesktop ? <Laptop className="size-5" /> : <Smartphone className="size-5" />}
           </div>
           <div className="flex flex-col">
              <h4 className="text-[9px] font-black tracking-[0.2em] text-[var(--accent)] uppercase mb-0.5 leading-none opacity-80 group-hover:opacity-100 transition-opacity">Aura Native</h4>
              <h2 className="text-xs font-black text-[var(--text-primary)] tracking-tight uppercase leading-none font-[Poppins,system-ui] flex items-center gap-2">
                 Install Mobile App <Sparkles className="size-3 text-[var(--accent)]" />
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
             className="size-10 rounded-xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:text-white hover:bg-rose-500/20 transition-all opacity-40 hover:opacity-100 flex items-center justify-center"
           >
             <X className="size-4" />
           </button>
        </div>

        {/* Liquid Shimmer Underlay */}
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none opacity-25">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[aura-shimmer_3s_infinite_linear]" />
        </div>

      </div>

      <style jsx>{`
        @keyframes aura-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
