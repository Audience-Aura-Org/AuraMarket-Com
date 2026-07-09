import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'aura_token';

export const isNativeAuthStorage = () => {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
};

export const getStoredAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  if (isNativeAuthStorage()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value || null;
  }

  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

export const setStoredAuthToken = async (token) => {
  if (typeof window === 'undefined') {
    console.warn('[authStorage] setStoredAuthToken: window is undefined');
    return;
  }
  
  if (!token) {
    console.warn('[authStorage] setStoredAuthToken: token is null/undefined, skipping storage');
    return;
  }

  if (isNativeAuthStorage()) {
    console.log('[authStorage] Saving token to native Preferences');
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }
  
  try {
    console.log(`[authStorage] Saving token to localStorage`);
    window.localStorage.setItem(TOKEN_KEY, token);
    console.log('[authStorage] ✅ Token saved to localStorage');
  } catch (err) {
    console.error('[authStorage] ❌ Failed to save token to localStorage:', err);
  }
};

export const clearStoredAuthToken = async () => {
  if (typeof window === 'undefined') return;

  if (isNativeAuthStorage()) {
    await Preferences.remove({ key: TOKEN_KEY });
  }

  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
};
