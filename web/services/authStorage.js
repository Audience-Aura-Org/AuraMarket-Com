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
  if (typeof window === 'undefined' || !token) return;

  if (isNativeAuthStorage()) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
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
