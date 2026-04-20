'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X } from 'lucide-react';

export default function PWAInstallBanner() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let timerId;

    // Check if already running as installed PWA (standalone mode or previously installed flag)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      localStorage.getItem('pwa_installed') === 'true';

    if (isStandalone) return;

    // Permanently hide after install via appinstalled event
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setIsVisible(false);
      if (timerId) clearTimeout(timerId);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    const ua = window.navigator.userAgent;
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const desktopCheck = window.innerWidth > 1024;

    setIsIOS(isIOSDevice);
    setIsDesktop(desktopCheck);

    // Use localStorage so the dismissed state survives page refreshes
    const isDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed) {
        timerId = setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS devices never fire beforeinstallprompt — show manually
    if (isIOSDevice && !isDismissed) {
      timerId = setTimeout(() => setIsVisible(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true');
      }
    });
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const dismiss = (e) => {
    e.stopPropagation();
    setIsVisible(false);
    // Use localStorage so it persists across sessions
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed z-[250] animate-in fade-in slide-in-from-bottom-6 duration-700 ${
      isDesktop
        ? 'bottom-6 right-6 w-80'
        : 'bottom-20 left-3 right-3 max-w-sm mx-auto'
    }`}>
      <div
        onClick={handleInstall}
        className="relative w-full bg-[var(--bg-primary)]/95 backdrop-blur-3xl rounded-2xl border border-[var(--glass-border)] flex items-center gap-3 p-3 pr-3 cursor-pointer shadow-2xl hover:border-[var(--accent)]/30 transition-all active:scale-[0.98] overflow-hidden"
      >
        {/* Accent shimmer line */}
        <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50" />

        {/* Logo */}
        <div className="size-10 rounded-xl bg-[#0d0d0d] flex items-center justify-center overflow-hidden shadow-lg ring-1 ring-white/10 shrink-0 transition-all">
          <img src="/icon-192.png" alt="Aura" className="size-full object-cover" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight leading-none mb-0.5">
            Install Aura Market
          </p>
          <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-50 leading-none">
            {isIOS ? 'Add to Home Screen for native experience' : 'Fast. Offline. Native app experience.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstall}
            className="h-8 px-3 rounded-xl bg-[var(--accent)] text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-[var(--accent)]/30 hover:opacity-90 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Download className="size-3" />
            Install
          </button>
          <button
            onClick={dismiss}
            className="size-8 rounded-xl bg-[var(--text-secondary)]/5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center border border-[var(--glass-border)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
