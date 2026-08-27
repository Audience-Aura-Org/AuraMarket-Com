'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import Link from 'next/link';
import { Download, Smartphone, X } from 'lucide-react';
import { registerPWA, subscribeToPush } from '@/lib/pwa-helper';
import { useAuthStore } from '@/hooks/useAuth';
import { registerNativeAndroidPush } from '@/lib/native-push';
import { toast } from 'react-hot-toast';

const APK_DOWNLOAD_URL = '/downloads/Auradime.apk?v=1.6.1';
const INSTALL_DISMISS_KEY = 'aura_install_prompt_dismissed_until';
const INSTALL_DONE_KEY = 'aura_pwa_installed';
const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalonePWA = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.navigator.standalone === true
  );
};

/**
 * PWAInit — Secure Background Channel Lifecycle
 * - Registers the Service Worker on mount
 * - Subscribes to push on login and on every app resume (visibility change)
 * - Handles the case where permission is granted anew after a re-visit
 */
export default function PWAInit() {
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installMessage, setInstallMessage] = useState('');
  const [statusComposerOpen, setStatusComposerOpen] = useState(false);
  const subscribedRef = useRef(false);
  const authErrorRef = useRef(false);
  const pushDeniedToastedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const lastSyncRef = useRef({ userId: null, at: 0 });
  // Always-current ref so event handlers with stable closures can call the latest attempt
  const attemptSubscriptionRef = useRef(null);
  const SYNC_COOLDOWN_MS = 3 * 60 * 1000;

  const attemptSubscription = async ({ promptIfNeeded = false } = {}) => {
    // If we already hit a definitive sync block this session, don't spam
    if (authErrorRef.current) return;
    if (!hasHydrated || !isAuthenticated) return;
    if (syncInFlightRef.current) return;

    const now = Date.now();
    const sameUser = lastSyncRef.current.userId === user?._id;
    if (!promptIfNeeded && sameUser && now - lastSyncRef.current.at < SYNC_COOLDOWN_MS) return;
    
    syncInFlightRef.current = true;
    try {
      console.log('[PWAInit] Syncing push registration...');
      const nativeResult = await registerNativeAndroidPush();
      const result = await subscribeToPush({ promptIfNeeded });

      if (nativeResult?.permission === 'denied' && !pushDeniedToastedRef.current) {
        pushDeniedToastedRef.current = true;
        toast(
          'Notifications are blocked. Enable them in Android Settings \u2192 Apps \u2192 Auradime \u2192 Notifications.',
          { duration: 6000 }
        );
      }

      if (nativeResult?.success || result?.success) {
        subscribedRef.current = true;
        authErrorRef.current = false;
        lastSyncRef.current = { userId: user?._id, at: Date.now() };
      } else if (result?.unauthorized) {
        console.warn('[PWAInit] Auth required for push sync. Suspending attempts until session refresh.');
        authErrorRef.current = true;
      } else if (result?.error === 'SERVICE_UNAVAILABLE') {
        console.info('[PWAInit] Push service unavailable on this device. Silencing sync.');
        authErrorRef.current = true;
      }
    } finally {
      syncInFlightRef.current = false;
    }
  };

  // Keep the ref pointing at the latest attemptSubscription so stable-closure handlers
  // (visibilitychange, gesture) always call the version that sees current auth state.
  attemptSubscriptionRef.current = attemptSubscription;

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + INSTALL_DISMISS_MS));
    } catch {}
  };

  const handleInstallWebApp = async () => {
    if (!installPrompt) {
      setInstallMessage('Use your browser menu to add Auradime to your home screen.');
      return;
    }

    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallMessage(result?.outcome === 'accepted' ? 'Auradime is installing.' : 'Install was dismissed.');
    if (result?.outcome === 'accepted') setShowInstallPrompt(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return;

    if (isStandalonePWA()) {
      try {
        window.localStorage.setItem(INSTALL_DONE_KEY, '1');
      } catch {}
      return;
    }

    const isSuppressed = () => {
      try {
        if (window.localStorage.getItem(INSTALL_DONE_KEY) === '1') return true;
        return Date.now() < Number(window.localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
      } catch {
        return false;
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      if (!isSuppressed()) setShowInstallPrompt(true);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
      try {
        window.localStorage.setItem(INSTALL_DONE_KEY, '1');
      } catch {}
    };

    const timer = setTimeout(() => {
      if (!isSuppressed()) setShowInstallPrompt(true);
    }, 4500);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    const handleStatusComposerVisibility = (event) => {
      const open = Boolean(event.detail?.open);
      setStatusComposerOpen(open);
      if (open) setShowInstallPrompt(false);
    };

    window.addEventListener('aura_status_composer_visibility', handleStatusComposerVisibility);
    return () => window.removeEventListener('aura_status_composer_visibility', handleStatusComposerVisibility);
  }, []);

  // 1. On initial mount, register SW and subscribe if user is logged in
  useEffect(() => {
    registerPWA();

    const timer = setTimeout(() => {
      attemptSubscription({ promptIfNeeded: false });
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasHydrated, isAuthenticated, user?._id]);

  // Browser notification prompts are most reliable when started by a real tap/click.
  // This keeps PWA push registration alive even when the initial timer cannot ask.
  // NOTE: We do NOT use { once: true } here — if the first attempt fires while the
  // mount timer's API call is in-flight (syncInFlightRef.current = true), the gesture
  // would be swallowed with { once: true } and the user would never be prompted again
  // until a page reload. Instead we rely on subscribedRef + syncInFlightRef to gate.
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserGesture = () => {
      if (subscribedRef.current) return;
      authErrorRef.current = false;
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'denied') return;
      }
      attemptSubscriptionRef.current?.({ promptIfNeeded: true });
    };

    window.addEventListener('pointerdown', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [hasHydrated, isAuthenticated, user?._id]);

  // 2. Re-subscribe when user identity changes
  // This ensures the device always has a valid endpoint linked to the correct user node
  useEffect(() => {
    if (user?._id && isAuthenticated && hasHydrated) {
      // Reset flags on user change to allow fresh attempt
      subscribedRef.current = false;
      authErrorRef.current = false;
      attemptSubscription({ promptIfNeeded: false });
    }
  }, [user?._id, isAuthenticated, hasHydrated]);

  // 3. On app resume (coming back from background), check and re-subscribe.
  // This is the CRITICAL FIX: handles permission granted while app was backgrounded
  // and ensures the device always has a valid, live subscription registered.
  // Uses attemptSubscriptionRef so the handler always sees current auth state even
  // though the effect dependency array is empty (stable listener, no re-registrations).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check current permission state directly from the browser API only if supported
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            console.log('[PWAInit] App resumed — re-syncing push...');
            attemptSubscriptionRef.current?.({ promptIfNeeded: false });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (
    !showInstallPrompt ||
    statusComposerOpen ||
    (typeof window !== 'undefined' && isStandalonePWA()) ||
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/messages') ||
    pathname?.startsWith('/admin/messages')
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-[9000] mx-auto max-w-md rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <button
        type="button"
        onClick={dismissInstallPrompt}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" />
      </button>

      <div className="flex gap-3 pr-8">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black p-1.5 ring-1 ring-white/10">
          <img src="/icon-512.png" alt="" className="size-full rounded-lg object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold tracking-tight">Get the Auradime app</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
            Install from this browser or download the Android APK.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
          <Link
            href="/install"
            onClick={dismissInstallPrompt}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-3 text-[12px] font-bold text-[var(--bg-primary)] transition hover:bg-[var(--accent)] hover:text-white"
          >
            <Smartphone className="size-4" />
            Install Guide
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleInstallWebApp}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-3 text-[12px] font-bold text-[var(--bg-primary)] transition hover:bg-[var(--accent)]"
          >
            <Smartphone className="size-4" />
            Install
          </button>
        )}
        <a
          href={APK_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:brightness-110"
        >
          <Download className="size-4" />
          Android
        </a>
      </div>

      {installMessage && (
        <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">
          {installMessage}
        </p>
      )}
    </div>
  );
}
