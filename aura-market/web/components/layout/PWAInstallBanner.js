'use client';

import { useState, useEffect } from 'react';
import { Download, XCircle, Sparkles, Smartphone } from 'lucide-react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if user has already dismissed it this session
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[150] animate-in fade-in slide-in-from-bottom-10 h-28 duration-700">
      <div className="h-full w-full glass-panel bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden group">
        
        {/* Liquid Glass Background Effects */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--accent)]/20 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />

        <div className="relative flex items-center justify-between h-full gap-4">
          <div className="flex items-center gap-4">
             <div className="size-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 ring-4 ring-white/10">
                <Smartphone className="w-7 h-7" />
             </div>
             <div>
                <h3 className="text-sm font-black text-white tracking-tight uppercase leading-none mb-1 shadow-sm">Install Aura Market</h3>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
                   <Sparkles className="w-3 h-3 text-[var(--accent)]" /> 
                   Fast • Offline • Secure
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={handleInstall}
                className="px-6 py-3 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
             >
                <Download className="w-3.5 h-3.5" /> 
                Add to Home
             </button>
             <button 
                onClick={dismiss}
                className="p-3 rounded-2xl bg-black/20 text-white/40 hover:text-white transition-colors"
             >
                <XCircle className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
