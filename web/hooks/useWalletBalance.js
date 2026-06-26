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

    refresh();
    window.addEventListener('aura:wallet-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('aura:wallet-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refreshWalletBalance]);

  return {
    walletBalance,
    displayedBalance,
    refreshWalletBalance,
    setWalletBalance,
  };
}
