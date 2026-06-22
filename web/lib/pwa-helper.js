'use client';

/**
 * lib/pwa-helper.js
 * Comprehensive PWA Service Worker Registration & Web Push Management
 */
import api from '@/services/api';

const FALLBACK_VAPID_PUBLIC_KEY = "BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ";

function isPushServiceUnavailable(err) {
  if (!err) return false;
  const name = err.name || '';
  const message = (err.message || '').toLowerCase();
  return name === 'AbortError' && message.includes('push service not available');
}

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

async function getActiveVapidPublicKey() {
  try {
    const res = await api.get('/push/vapid-public-key');
    const key = res.data?.data?.publicKey || res.data?.publicKey;
    return key || FALLBACK_VAPID_PUBLIC_KEY;
  } catch (err) {
    console.warn('[PWA] Could not fetch backend VAPID key; using fallback.', err?.message || err);
    return FALLBACK_VAPID_PUBLIC_KEY;
  }
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

    registration.update().catch(() => {});
    registration.addEventListener?.('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    if (!window.__auraSwControllerReloadBound) {
      window.__auraSwControllerReloadBound = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

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
export async function subscribeToPush({ promptIfNeeded = true } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null;
  }

  try {
    // Request permission if not yet granted
    let permission = Notification.permission;
    if (permission === 'default') {
      if (!promptIfNeeded) {
        console.log('[PWA] Notification permission not granted yet — waiting for user gesture.');
        return { success: false, permission: 'default' };
      }
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      if (permission === 'denied') {
        console.log('[PWA] Push permission previously denied by user.');
      } else {
        console.warn('⚠️ Push permission denied by user.');
      }
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await getActiveVapidPublicKey();

    // Always get or create subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[PWA] No existing subscription found — creating new one...');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      } catch (subscribeErr) {
        if (isPushServiceUnavailable(subscribeErr)) {
          console.info('[PWA] Push service unavailable in this browser/device. Skipping subscription.');
          return null;
        }
        throw subscribeErr;
      }
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
    return { success: true, subscription };
  } catch (err) {

    // 2. Handle VAPID mismatch, expired or invalid subscription errors
    if (err.name === 'InvalidStateError' || err.code === 0 || err.name === 'AbortError') {
      console.warn('[PWA] Subscription error detected — purging stale subscriptions and resubscribing...');
      try {
        // 1. Clear this device's local browser subscription
        const reg = await navigator.serviceWorker.ready;
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe();

        // 2. Purge ALL stale subscriptions from the backend DB for this user
        await api.delete('/push/purge-all').catch(() => { });
        console.log('[PWA] Backend subscriptions purged — creating fresh registration...');

        // 3. Re-subscribe with correct VAPID key (one retry only)
        const reg2 = await navigator.serviceWorker.ready;
        const retryVapidPublicKey = await getActiveVapidPublicKey();
        const newSub = await reg2.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(retryVapidPublicKey)
        });
        await api.post('/push/subscribe', {
          subscription: newSub.toJSON(),
          device_type: window.innerWidth < 768 ? 'mobile' : 'desktop'
        });
        console.log('✅ [PWA] Fresh push subscription registered after recovery.');
        return { success: true, subscription: newSub };
      } catch (retryErr) {
        if (isPushServiceUnavailable(retryErr)) {
          console.info('[PWA] Recovery skipped: push service unavailable for this browser/device.');
          return { success: false, error: 'SERVICE_UNAVAILABLE' };
        }
        console.error('[PWA] Recovery subscription failed:', retryErr.message);
      }
    }
    const isUnauthorizedError = /401|unauthorized|unauthenticated/i.test(
      err?.response?.status || 
      err?.response?.data?.message || 
      err?.message || 
      ''
    );

    if (isUnauthorizedError) {
      return { success: false, unauthorized: true };
    }

    console.error('❌ Push Subscription Error:', err.name, err.message);
    return { success: false, error: 'UNKNOWN', message: err.message };
  }
}

export async function unsubscribeCurrentPushEndpoint({ removeBrowserSubscription = false } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, unsupported: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription?.endpoint) return { success: true, unchanged: true };

    await api.delete('/push/unsubscribe', {
      data: { endpoint: subscription.endpoint },
      __skipRetry: true,
    }).catch((error) => {
      if (error?.response?.status !== 401) throw error;
    });

    if (removeBrowserSubscription) {
      await subscription.unsubscribe().catch(() => {});
    }

    return { success: true };
  } catch (err) {
    console.warn('[PWA] Push unsubscribe skipped:', err?.message || err);
    return { success: false, error: err?.message || 'UNSUBSCRIBE_FAILED' };
  }
}
