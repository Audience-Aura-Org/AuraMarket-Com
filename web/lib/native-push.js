'use client';

import api from '@/services/api';

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
      const url = notification?.data?.url || notification?.data?.link || '/notifications';
      window.location.href = url;
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
    if (!modules) return { success: true, unsupported: true };

    await modules.PushNotifications.removeAllListeners();
    return { success: true };
  } catch (error) {
    console.warn('[FCM] Native push cleanup skipped:', error?.message || error);
    return { success: false };
  }
}
