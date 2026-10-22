"use client";

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';

/**
 * Keeps the signed-in user's wallet balance fresh for every component that
 * shows it (top nav, mobile header, dashboards, wallet pages).
 *
 * The store's walletBalance is the single source of truth. Refresh triggers
 * (mount, focus, tab visible, navigation, financial events, socket reconnect,
 * 60s poll) are installed ONCE no matter how many components use this hook,
 * share one debounced request, and are removed when the last one unmounts.
 * Socket balance pushes are applied by SocketProvider.
 */

const DEBOUNCE_MS = 400;
const POLL_MS = 60_000;

let consumers = 0;
let teardown = null;
let debounceTimer = null;

const refreshNow = () => {
  try {
    useAuthStore.getState().refreshWalletBalance?.()?.catch?.(() => {});
  } catch (_) { /* non-critical */ }
};

const scheduleRefresh = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    refreshNow();
  }, DEBOUNCE_MS);
};

function installSync() {
  const onVisibility = () => { if (!document.hidden) scheduleRefresh(); };
  // Events that already carry a balance were applied by the store.
  const onWalletUpdated = (event) => {
    if (!Number.isFinite(Number(event?.detail?.balance))) scheduleRefresh();
  };

  // Next.js App Router navigates with history.pushState/replaceState.
  let lastHref = window.location.href;
  const onNavigate = () => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    scheduleRefresh();
  };
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  const patchedPush = function pushState(...args) {
    const result = originalPush.apply(this, args);
    onNavigate();
    return result;
  };
  const patchedReplace = function replaceState(...args) {
    const result = originalReplace.apply(this, args);
    onNavigate();
    return result;
  };
  window.history.pushState = patchedPush;
  window.history.replaceState = patchedReplace;

  window.addEventListener('focus', scheduleRefresh);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('aura:financial-update', scheduleRefresh);
  window.addEventListener('aura:wallet-updated', onWalletUpdated);
  window.addEventListener('popstate', onNavigate);
  socketService.on('connect', scheduleRefresh);
  socketService.on('withdrawal:paid', scheduleRefresh);
  const poll = setInterval(() => { if (!document.hidden) refreshNow(); }, POLL_MS);

  refreshNow();

  return () => {
    clearInterval(poll);
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    window.removeEventListener('focus', scheduleRefresh);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('aura:financial-update', scheduleRefresh);
    window.removeEventListener('aura:wallet-updated', onWalletUpdated);
    window.removeEventListener('popstate', onNavigate);
    socketService.off('connect', scheduleRefresh);
    socketService.off('withdrawal:paid', scheduleRefresh);
    // Only restore if nobody wrapped history after us.
    if (window.history.pushState === patchedPush) window.history.pushState = originalPush;
    if (window.history.replaceState === patchedReplace) window.history.replaceState = originalReplace;
  };
}

export function useWalletBalance() {
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  const updateBalance = useCallback((balance) => {
    const b = Number(balance);
    if (!Number.isFinite(b)) return;
    setWalletBalance(b);
  }, [setWalletBalance]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    consumers += 1;
    if (consumers === 1) teardown = installSync();
    return () => {
      consumers -= 1;
      if (consumers === 0 && teardown) {
        teardown();
        teardown = null;
      }
    };
  }, []);

  return {
    walletBalance,
    displayedBalance: Number(walletBalance ?? 0),
    refreshWalletBalance,
    setWalletBalance: updateBalance,
  };
}
