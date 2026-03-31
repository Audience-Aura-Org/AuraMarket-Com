'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Laptop, Smartphone, Sparkles } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let timerId;
    
    // Prevent showing if already standalone
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
    <div className="fixed bottom-20 left-0 right-0 z-[250] animate-in fade-in slide-in-from-bottom-5 duration-700 w-full">
      
      {/* Slim Full-Width Bar */}
      <div 
        onClick={handleInstall}
        className="group relative h-12 w-full bg-[var(--bg-primary)]/80 backdrop-blur-3xl border-t border-[var(--glass-border)] flex items-center justify-between px-6 cursor-pointer hover:bg-[var(--accent)]/[0.03] transition-colors"
      >
        
        {/* Left Side: Label */}
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="size-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Sparkles className="size-3.5 fill-[var(--accent)]" />
           </div>
           <p className="text-[10px] font-black text-[var(--text-primary)] tracking-[0.2em] uppercase truncate opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Aura Standalone <span className="opacity-40 font-bold mx-2">•</span> Offline & Fast
           </p>
        </div>

        {/* Right Side: Action + Close */}
        <div className="flex items-center gap-6">
           <button 
              className="text-[10px] font-black text-[var(--accent)] tracking-widest uppercase hover:underline flex items-center gap-2 group-hover:scale-105 transition-transform"
           >
              <Download className="size-3" />
              Install Now 🚀
           </button>
           <button 
             onClick={dismiss}
             className="p-1 px-2 rounded-lg hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-all opacity-40 hover:opacity-100 border border-transparent hover:border-[var(--glass-border)]"
           >
             <X className="size-3.5" />
           </button>
        </div>

        {/* Liquid Shimmer Accent */}
        <div className="absolute top-0 left-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent w-full opacity-40 animate-[shimmer_3s_infinite_linear]" style={{ backgroundSize: '100% 100%' }} />
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
