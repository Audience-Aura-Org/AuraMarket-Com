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

    const refresh = () => {
      refreshWalletBalance().catch(() => {});
    };

    // Only hit the API on mount when we have no cached balance yet.
    // When the store already holds a value (set during login / fetchMe),
    // show it immediately and let the event listeners handle updates.
    if (walletBalance === null) {
      refresh();
    }

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
    // otherwise fall back to an API refresh (old gateway paths without balance).
    const onWalletCredited = (data) => {
      if (data?.balance !== undefined && Number.isFinite(Number(data.balance))) {
        // Backend sent the post-credit balance — zero round-trips, instant update.
        setWalletBalance(Number(data.balance));
      } else {
        refresh();
      }
    };

    // Wallet debits (subscription and wallet checkout) include the same
    // authoritative post-debit balance as credits.
    socketService.on('wallet:credited', onWalletCredited);
    socketService.on('wallet:debited', onWalletCredited);
    socketService.on('withdrawal:paid', refresh);

    return () => {
      window.removeEventListener('aura:wallet-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('popstate', onNavChange);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      socketService.off('wallet:credited', onWalletCredited);
      socketService.off('wallet:debited', onWalletCredited);
      socketService.off('withdrawal:paid', refresh);
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
