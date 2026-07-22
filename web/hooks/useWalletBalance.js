"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuth';

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

    window.addEventListener('aura:wallet-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('aura:wallet-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
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
