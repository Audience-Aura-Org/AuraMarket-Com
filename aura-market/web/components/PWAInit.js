'use client';

import { useEffect } from 'react';
import { registerPWA, subscribeToPush } from '@/lib/pwa-helper';

/**
 * PWAInit — Secure Background Channel Lifecycle
 * Automatically registers the Service Worker on mount and 
 * ensures the app is synced with the PWA notification Matrix.
 */
export default function PWAInit() {
  useEffect(() => {
    // 1. Initial SW Registration
    registerPWA();

    // 2. Delayed Permission Check for Subscriptions
    // We wait a few seconds to let the UX settle before 
    // requesting push synchronization for logged in users.
    const timer = setTimeout(() => {
      let token = localStorage.getItem('aura_token');
      if (!token) {
        try {
          const stored = localStorage.getItem('aura-auth-storage');
          if (stored) token = JSON.parse(stored)?.state?.token;
        } catch (e) {}
      }

      if (token && token !== 'undefined' && token !== 'null') {
        subscribeToPush();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
