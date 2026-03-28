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
  const { user } = useAuthStore();
  const pathname = usePathname();
  const subscribedRef = useRef(false);

  const attemptSubscription = async () => {
    let token = localStorage.getItem('aura_token');
    if (!token) {
      try {
        const stored = localStorage.getItem('aura-auth-storage');
        if (stored) token = JSON.parse(stored)?.state?.token;
      } catch (e) {}
    }
    if (!token || token === 'undefined' || token === 'null') return;
    
    console.log('[PWAInit] Syncing push registration at node:', pathname);
    await subscribeToPush();
    subscribedRef.current = true;
  };

  // 1. On initial mount, register SW and subscribe if user is logged in
  useEffect(() => {
    registerPWA();

    const timer = setTimeout(() => {
      attemptSubscription();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // 2. Re-subscribe when path changes or user identity changes
  // This ensures the device always has a valid endpoint even during long sessions
  useEffect(() => {
    if (user?._id) {
      attemptSubscription();
    }
  }, [user?._id, pathname]);

  // 3. On app resume (coming back from background), check and re-subscribe.
  // This is the CRITICAL FIX: handles permission granted while app was backgrounded
  // and ensures the device always has a valid, live subscription registered.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check current permission state directly from the browser API
        if (Notification.permission === 'granted' && !subscribedRef.current) {
          console.log('[PWAInit] App resumed with granted permission — re-syncing push...');
          attemptSubscription();
        }
        // If permission was just granted (was "default" before), also sync
        if (Notification.permission === 'granted') {
          attemptSubscription();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return null;
}
