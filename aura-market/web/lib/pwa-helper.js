'use client';

/**
 * lib/pwa-helper.js
 * Comprehensive PWA Service Worker Registration & Web Push Management
 */
import api from '@/services/api';

const VAPID_PUBLIC_KEY = "BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ";

// Helper to convert base64 to Uint8Array for VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the Service Worker and returns the registration.
 */
export async function registerPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    console.log('🚀 Aura SW Registered:', registration.scope);
    // Force SW to activate immediately without waiting for tabs to close
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    return registration;
  } catch (err) {
    console.error('❌ PWA Registration Failed:', err);
    return null;
  }
}

/**
 * Requests notification permission and syncs subscription to backend.
 * Always re-syncs the current subscription — handles stale/expired subs
 * and ensures the backend always has the latest push endpoint.
 */
export async function subscribeToPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  let token = localStorage.getItem('aura_token');
  if (!token) {
    try {
      const stored = localStorage.getItem('aura-auth-storage');
      if (stored) token = JSON.parse(stored)?.state?.token;
    } catch (e) {}
  }

  if (!token || token === 'undefined' || token === 'null') {
    console.log('[PWA] No auth token — skipping push subscription');
    return null;
  }

  try {
    // Request permission if not yet granted
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission !== 'granted') {
      console.warn('⚠️ Push permission denied by user.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Always get or create subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[PWA] No existing subscription found — creating new one...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[PWA] New push subscription created:', subscription.endpoint.slice(-20));
    } else {
      console.log('[PWA] Existing subscription found — re-syncing with backend...');
    }

    // Always sync the subscription to the backend (handles stale entries)
    const res = await api.post('/push/subscribe', { 
      subscription: subscription.toJSON(), 
      device_type: window.innerWidth < 768 ? 'mobile' : 'desktop' 
    });

    if (res.data?.success) {
      console.log('✅ Push subscription synchronized with Aura Matrix.');
    }
    return subscription;
  } catch (err) {
    // Handle VAPID mismatch, expired or invalid subscription errors
    if (err.name === 'InvalidStateError' || err.code === 0 || err.name === 'AbortError') {
      console.warn('[PWA] Subscription error detected — purging stale subscriptions and resubscribing...');
      try {
        // 1. Clear this device's local browser subscription
        const reg = await navigator.serviceWorker.ready;
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe();

        // 2. Purge ALL stale subscriptions from the backend DB for this user
        await api.delete('/push/purge-all').catch(() => {});
        console.log('[PWA] Backend subscriptions purged — creating fresh registration...');

        // 3. Re-subscribe with correct VAPID key (one retry only)
        const reg2 = await navigator.serviceWorker.ready;
        const newSub = await reg2.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await api.post('/push/subscribe', { 
          subscription: newSub.toJSON(), 
          device_type: window.innerWidth < 768 ? 'mobile' : 'desktop' 
        });
        console.log('✅ [PWA] Fresh push subscription registered after recovery.');
        return newSub;
      } catch (retryErr) {
        console.error('[PWA] Recovery subscription failed:', retryErr.message);
      }
    }
    console.error('❌ Push Subscription Error:', err.name, err.message);
    return null;
  }
}
