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
  const { user, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const subscribedRef = useRef(false);
  const authErrorRef = useRef(false);

  const attemptSubscription = async () => {
    // If we already hit a definitive sync block this session, don't spam
    if (authErrorRef.current) return;
    if (!isAuthenticated) return;

    let token = localStorage.getItem('aura_token');
    if (!token) {
      try {
        const stored = localStorage.getItem('aura-auth-storage');
        if (stored) token = JSON.parse(stored)?.state?.token;
      } catch (e) {}
    }
    if (!token || token === 'undefined' || token === 'null') return;
    
    console.log('[PWAInit] Syncing push registration...');
    const result = await subscribeToPush();
    
    if (result?.success) {
      subscribedRef.current = true;
      authErrorRef.current = false;
    } else if (result?.unauthorized) {
      console.warn('[PWAInit] Auth required for push sync. Suspending attempts until session refresh.');
      authErrorRef.current = true;
    } else if (result?.error === 'SERVICE_UNAVAILABLE') {
      console.info('[PWAInit] Push service unavailable on this device. Silencing sync.');
      authErrorRef.current = true;
    }
  };

  // 1. On initial mount, register SW and subscribe if user is logged in
  useEffect(() => {
    registerPWA();

    const timer = setTimeout(() => {
      attemptSubscription();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // 2. Re-subscribe when user identity changes
  // This ensures the device always has a valid endpoint linked to the correct user node
  useEffect(() => {
    if (user?._id && isAuthenticated) {
      // Reset flags on user change to allow fresh attempt
      subscribedRef.current = false;
      authErrorRef.current = false;
      attemptSubscription();
    }
  }, [user?._id, isAuthenticated]);

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
