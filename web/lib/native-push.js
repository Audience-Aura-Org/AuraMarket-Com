'use client';

import api from '@/services/api';

const NATIVE_PUSH_TOKEN_KEY = 'aura_native_push_token';
const PENDING_PUSH_INTENT_KEY = 'aura_pending_push_intent';

const saveNativePushToken = (token) => {
  if (typeof window === 'undefined' || !token) return;
  window.localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, token);
};

const readNativePushToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(NATIVE_PUSH_TOKEN_KEY) || null;
};

const clearNativePushToken = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
};

const parseSenderData = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const storePendingPushIntent = (intent) => {
  if (typeof window === 'undefined' || !intent) return;
  window.localStorage.setItem(PENDING_PUSH_INTENT_KEY, JSON.stringify({
    ...intent,
    storedAt: Date.now(),
  }));
};

export function consumePendingNativePushIntent() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PENDING_PUSH_INTENT_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_PUSH_INTENT_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function peekPendingPushIntentForVendor(vendorId) {
  if (typeof window === 'undefined' || !vendorId) return null;
  const raw = window.localStorage.getItem(PENDING_PUSH_INTENT_KEY);
  if (!raw) return null;
  try {
    const intent = JSON.parse(raw);
    const senderId = intent?.senderId?.toString?.() || intent?.senderId;
    if (!senderId || senderId.toString() !== vendorId.toString()) return null;
    return intent.title || intent.senderData?.name || intent.senderData?.store_name || null;
  } catch {
    return null;
  }
}

async function getNativePushModules() {
  if (typeof window === 'undefined') return null;

  const [{ Capacitor }, { PushNotifications }] = await Promise.all([
    import('@capacitor/core'),
    import('@capacitor/push-notifications'),
  ]);

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }

  return { PushNotifications };
}

export async function registerNativeAndroidPush() {
  try {
    const modules = await getNativePushModules();
    if (!modules) return { success: false, unsupported: true };

    const { PushNotifications } = modules;
    let permission = await PushNotifications.checkPermissions();

    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') {
      console.warn('[FCM] Android push permission not granted.');
      return { success: false, permission: permission.receive };
    }

    await PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async ({ value }) => {
      if (!value) return;
      saveNativePushToken(value);
      try {
        await api.post('/push/native-token', {
          token: value,
          platform: 'android',
          device_type: 'android',
        }, { __skipRetry: true });
        console.log('✅ [FCM] Android push token synchronized.');
      } catch (error) {
        console.warn('[FCM] Could not sync Android push token:', error?.message || error);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.warn('[FCM] Android push registration failed:', error?.error || error?.message || error);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const intent = {
        url: notification?.data?.url || notification?.data?.link || '/notifications',
        type: notification?.data?.type || 'default',
        senderId: notification?.data?.sender_id || notification?.data?.senderId || null,
        title: notification?.title || notification?.data?.title || null,
        senderData: parseSenderData(notification?.data?.senderData),
      };
      storePendingPushIntent(intent);
      window.dispatchEvent(new CustomEvent('aura:push-notification-click', { detail: intent }));
    });

    // When a push arrives while the APK is foregrounded (socket may still be reconnecting),
    // signal MessagingHub to pull the active conversation immediately.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const senderId = notification?.data?.sender_id || notification?.data?.senderId || null;
      const type = notification?.data?.type || 'default';
      if (type === 'message' && senderId) {
        window.dispatchEvent(new CustomEvent('aura:pull-conversation', {
          detail: { partnerId: senderId.toString() },
        }));
      }
    });

    await PushNotifications.register();
    return { success: true };
  } catch (error) {
    console.warn('[FCM] Native Android push unavailable:', error?.message || error);
    return { success: false, error: error?.message || 'NATIVE_PUSH_FAILED' };
  }
}

export async function unregisterNativeAndroidPushToken() {
  try {
    const modules = await getNativePushModules();
    const token = readNativePushToken();

    if (token) {
      await api.delete('/push/native-token', {
        data: { token },
        __skipRetry: true,
      }).catch((error) => {
        if (![401, 403].includes(error?.response?.status)) throw error;
      });
      clearNativePushToken();
    }

    if (!modules) return { success: true, unsupported: true };

    await modules.PushNotifications.removeAllListeners();
    return { success: true };
  } catch (error) {
    console.warn('[FCM] Native push cleanup skipped:', error?.message || error);
    return { success: false };
  }
}
