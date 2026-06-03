'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { registerPWA, subscribeToPush } from '@/lib/pwa-helper';
import { useAuthStore } from '@/hooks/useAuth';

/**
 * PWAInit — Secure Background Channel Lifecycle
 * - Registers the Service Worker on mount
 * - Subscribes to push on login and on every app resume (visibility change)
 * - Handles the case where permission is granted anew after a re-visit
 */
export default function PWAInit() {
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const subscribedRef = useRef(false);
  const authErrorRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const lastSyncRef = useRef({ userId: null, at: 0 });
  const SYNC_COOLDOWN_MS = 10 * 60 * 1000;

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
      const result = await subscribeToPush({ promptIfNeeded });

      if (result?.success) {
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
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserGesture = () => {
      if (subscribedRef.current) return;
      authErrorRef.current = false;
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'denied') return;
      }
      attemptSubscription({ promptIfNeeded: true });
    };

    window.addEventListener('pointerdown', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });

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
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check current permission state directly from the browser API only if supported
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted' && !subscribedRef.current) {
            console.log('[PWAInit] App resumed with granted permission - re-syncing push...');
            attemptSubscription({ promptIfNeeded: false });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return null;
}
