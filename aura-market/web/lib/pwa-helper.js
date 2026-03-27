'use client';

/**
 * lib/pwa-helper.js
 * Comprehensive PWA Service Worker Registration & Web Push Management
 */

const VAPID_PUBLIC_KEY = "BMiW0FBPikPVXuG3v_llaQ3lgb1MfPiM_CEcKXafkGvc3KShUCR3OQkjXepzdMzaDzVxW-C8f8kBbLcTZLX9TiM";

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
 * Registers the Service Worker and Subscribes if necessary.
 */
export async function registerPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('🚀 Aura SW Registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('❌ PWA Registration Failed:', err);
    return null;
  }
}

/**
 * Requests notification permission and triggers subscription.
 */
export async function subscribeToPush() {
  let token = localStorage.getItem('aura_token');
  if (!token) {
    try {
      const stored = localStorage.getItem('aura-auth-storage');
      if (stored) token = JSON.parse(stored)?.state?.token;
    } catch (e) {}
  }

  if (!token || token === 'undefined' || token === 'null') return; // Only subscribe logged in users

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ Push permission denied by user.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Sync with backend
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/push/subscribe`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        subscription, 
        device_type: window.innerWidth < 768 ? 'mobile' : 'desktop' 
      })
    });

    const data = await res.json();
    if (data.success) {
      console.log('✅ Matrix Connection Stabilized (Push Synchronized).');
    }
    return subscription;
  } catch (err) {
    console.error('❌ Push Subscription Error:', err);
    return null;
  }
}
