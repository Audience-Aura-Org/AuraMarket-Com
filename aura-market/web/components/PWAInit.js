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
      if (localStorage.getItem('token')) {
        subscribeToPush();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
