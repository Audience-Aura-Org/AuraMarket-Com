'use client';

import { useState, useEffect } from 'react';
import { Download, XCircle, Sparkles, Smartphone } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let timerId;
    
    // Prevent showing if already installed standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Detect iOS (including newer iPhones/iPads that spoof macOS/MacIntel)
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing automatically
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        timerId = setTimeout(() => {
          setIsVisible(true);
        }, 3000); // Reduced delay for better engagement
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS/iPadOS doesn't fire beforeinstallprompt.
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
    console.log(`PWA Response: ${outcome}`);
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[250] animate-in fade-in slide-in-from-bottom-10 h-28 duration-700">
      <div className="h-full w-full glass-panel bg-[var(--bg-primary)]/80 backdrop-blur-3xl border border-[var(--accent)]/20 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group">
        
        {/* Liquid Glass Background Background Effects */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--accent)]/15 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />

        <div className="relative flex items-center justify-between h-full gap-4">
          <div className="flex items-center gap-4">
             <div className="size-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 ring-4 ring-[var(--accent)]/10">
                <Smartphone className="w-7 h-7" />
             </div>
             <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] tracking-tight uppercase leading-none mb-1">Aura on Mobile</h3>
                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-1.5 opacity-60">
                   <Sparkles className="w-3 h-3 text-[var(--accent)]" /> 
                   Liquid • Offline 🧪
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={handleInstall}
                className="px-6 py-3 rounded-2xl bg-[var(--accent)] text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[var(--accent)]/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
             >
                <Download className="w-3.5 h-3.5" /> 
                Install
             </button>
             <button 
                onClick={dismiss}
                className="p-3 rounded-2xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
             >
                <XCircle className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
