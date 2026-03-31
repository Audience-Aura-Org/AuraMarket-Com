'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X, Laptop, Smartphone, Zap } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let timerId;
    
    // Prevent showing if already standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Device Context
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
       // Redirect to the stylish instructions page for iOS
       router.push('/onboarding/pwa');
       setIsVisible(false);
       return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
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
    <div className={`fixed z-[250] animate-in fade-in slide-in-from-bottom-8 duration-700 pointer-events-none ${isDesktop ? 'bottom-8 right-8' : 'bottom-24 left-1/2 -translate-x-1/2 w-fit min-w-[200px]'}`}>
      
      {/* Slim Floating Pill */}
      <div 
        onClick={handleInstall}
        className="group relative flex items-center gap-3 px-4 py-2 bg-[var(--bg-primary)]/80 backdrop-blur-2xl rounded-full border border-[var(--glass-border)] hover:border-[var(--accent)]/30 shadow-2xl transition-all cursor-pointer pointer-events-auto active:scale-95"
      >
        <div className="size-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 ring-2 ring-[var(--accent)]/10 transform group-hover:scale-110 transition-transform duration-300">
           {isDesktop ? <Laptop className="size-4" /> : <Smartphone className="size-4" />}
        </div>
        
        <div className="flex flex-col pr-8">
           <h4 className="text-[9px] font-black tracking-widest text-[var(--accent)] uppercase mb-0.5 leading-none">Aura Experience</h4>
           <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-tight uppercase leading-none whitespace-nowrap">Install Standalone</h3>
        </div>

        {/* Action Controls */}
        <button 
          onClick={dismiss}
          className="absolute right-2 p-1.5 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-40 hover:opacity-100"
        >
          <X className="size-3" />
        </button>

        {/* Minimal Shimmer */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
