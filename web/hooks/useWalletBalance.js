"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';

export function useWalletBalance() {
  const walletBalance = useAuthStore((state) => state.walletBalance);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);
  const displayedBalance = Number(walletBalance ?? 0);

  useEffect(() => {
    if (!refreshWalletBalance) return undefined;

    // Debounce API refreshes — multiple events (focus, visibility, navigation)
    // can fire in quick succession; without debouncing each triggers a separate
    // API call and the last to resolve wins, potentially overwriting a fresher
    // value with a stale one.
    let debounceTimer = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshWalletBalance().catch(() => {});
      }, 400);
    };

    // Always refresh from the API on mount so the TopNav balance stays
    // accurate after full page reloads (the persisted Zustand value may
    // be stale if a refund, deposit, or withdrawal settled server-side).
    // The cached value is shown immediately — the API call updates it
    // in the background without a loading flash.
    refreshWalletBalance().catch(() => {});

    // Window / visibility events
    window.addEventListener('aura:wallet-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    // Detect in-app navigation (Next.js App Router uses pushState/replaceState)
    // so the TopNav balance stays current even when socket events are missed.
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

    // Socket events — update instantly from payload when balance is included,
    // otherwise fetch fresh from the API immediately (no debounce — socket events
    // fire at most once per transaction, unlike focus/navigation which can fire rapidly).
    const onWalletCredited = (data) => {
      if (data?.balance !== undefined && Number.isFinite(Number(data.balance))) {
        // Backend sent the post-credit balance — zero round-trips, instant update.
        setWalletBalance(Number(data.balance));
      } else {
        // No balance in payload — fetch live balance right away.
        refreshWalletBalance().catch(() => {});
      }
    };

    // Wallet debits (subscription and wallet checkout) include the same
    // authoritative post-debit balance as credits.
    const onWithdrawalPaid = () => refreshWalletBalance().catch(() => {});

    // Reconnect recovery — any wallet:credited/debited events emitted while the
    // socket was disconnected are lost. Re-fetching on every (re)connect ensures
    // the balance is reconciled as soon as connectivity is restored.
    const onSocketConnect = () => refreshWalletBalance().catch(() => {});

    socketService.on('connect', onSocketConnect);
    socketService.on('wallet:credited', onWalletCredited);
    socketService.on('wallet:debited', onWalletCredited);
    socketService.on('withdrawal:paid', onWithdrawalPaid);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('aura:wallet-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('popstate', onNavChange);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      socketService.off('connect', onSocketConnect);
      socketService.off('wallet:credited', onWalletCredited);
      socketService.off('wallet:debited', onWalletCredited);
      socketService.off('withdrawal:paid', onWithdrawalPaid);
    };
  // walletBalance intentionally excluded — we only want to run this once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshWalletBalance]);

  return {
    walletBalance,
    displayedBalance,
    refreshWalletBalance,
    setWalletBalance,
  };
}
