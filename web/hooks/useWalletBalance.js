"use client";

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';

export function useWalletBalance() {
  // Read directly from Zustand — single source of truth, no local mirror.
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  const updateBalance = useCallback((balance) => {
    const b = Number(balance);
    if (!Number.isFinite(b)) return;
    setWalletBalance(b);
  }, [setWalletBalance]);

  useEffect(() => {
    if (!refreshWalletBalance) return undefined;

    const doRefresh = async () => {
      try { await refreshWalletBalance(); } catch (_) { /* non-critical */ }
    };

    // Debounce API refreshes
    let debounceTimer = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doRefresh, 400);
    };

    // Refresh from API on mount
    doRefresh();

    // ── Window / visibility events ──────────────────────────────────────
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // Financial events from SocketProvider (deposit, withdrawal, payment, etc.)
    window.addEventListener('aura:financial-update', refresh);
    // A local transaction can finish before its Socket.IO event reaches this
    // browser. Refresh immediately so the persistent top nav shows the
    // committed debit or credit without waiting for navigation or polling.
    // Store-originated events include a balance and have already updated state.
    const onWalletUpdated = (event) => {
      if (Number.isFinite(Number(event?.detail?.balance))) return;
      doRefresh();
    };
    window.addEventListener('aura:wallet-updated', onWalletUpdated);

    // Detect in-app navigation (Next.js App Router uses pushState/replaceState)
    let lastHref = location.href;
    const onNavChange = () => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        refresh();
      }
    };
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    history.pushState = function (...args) {
      origPushState.apply(this, args);
      onNavChange();
    };
    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      onNavChange();
    };
    window.addEventListener('popstate', onNavChange);

    // ── Socket events ───────────────────────────────────────────────────
    const onWalletEvent = (data) => {
      if (data?.balance !== undefined && Number.isFinite(Number(data.balance))) {
        setWalletBalance(Number(data.balance));
      } else {
        doRefresh();
      }
    };
    const onWithdrawalPaid = () => doRefresh();
    const onSocketConnect = () => doRefresh();

    socketService.on('connect', onSocketConnect);
    socketService.on('wallet:credited', onWalletEvent);
    socketService.on('wallet:debited', onWalletEvent);
    socketService.on('withdrawal:paid', onWithdrawalPaid);

    // Polling fallback
    const pollInterval = setInterval(doRefresh, 60_000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('aura:financial-update', refresh);
      window.removeEventListener('aura:wallet-updated', onWalletUpdated);
      window.removeEventListener('popstate', onNavChange);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      socketService.off('connect', onSocketConnect);
      socketService.off('wallet:credited', onWalletEvent);
      socketService.off('wallet:debited', onWalletEvent);
      socketService.off('withdrawal:paid', onWithdrawalPaid);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshWalletBalance]);

  return {
    walletBalance,
    displayedBalance: Number(walletBalance ?? 0),
    refreshWalletBalance,
    setWalletBalance: updateBalance,
  };
}
