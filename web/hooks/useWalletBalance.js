"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';

/**
 * Broadcast a balance value on the window so ANY mounted component can
 * pick it up — completely independent of Zustand subscription propagation.
 */
const broadcastBalance = (balance) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('aura:wallet-updated', { detail: { balance } })
    );
  } catch (_) { /* SSR / test guard */ }
};

export function useWalletBalance() {
  // Zustand store (persisted, authoritative)
  const zustandBalance = useAuthStore((state) => state.walletBalance);
  const refreshWalletBalance = useAuthStore((state) => state.refreshWalletBalance);
  const setWalletBalance = useAuthStore((state) => state.setWalletBalance);

  // Local state mirror — this is what TopNav actually renders.
  // Using local useState guarantees a React re-render even if Zustand's
  // subscription propagation is stalled by Next.js App Router batching
  // or persist middleware quirks.
  const [localBalance, setLocalBalance] = useState(zustandBalance);

  // Keep local state in sync whenever zustand value changes (e.g. page refresh)
  useEffect(() => {
    if (zustandBalance !== null && zustandBalance !== undefined) {
      setLocalBalance(zustandBalance);
    }
  }, [zustandBalance]);

  // Unified setter: updates Zustand + local state + broadcasts to window
  const updateBalance = useCallback((balance) => {
    const b = Number(balance);
    if (!Number.isFinite(b)) return;
    setLocalBalance(b);
    setWalletBalance(b);
    broadcastBalance(b);
  }, [setWalletBalance]);

  useEffect(() => {
    if (!refreshWalletBalance) return undefined;

    // Wrap refreshWalletBalance to also push result to local state + broadcast
    const doRefresh = async () => {
      try {
        const result = await refreshWalletBalance();
        if (result?.success && Number.isFinite(result.balance)) {
          setLocalBalance(result.balance);
          broadcastBalance(result.balance);
        }
      } catch (_) { /* non-critical */ }
    };

    // Debounce API refreshes — multiple events (focus, visibility, navigation)
    // can fire in quick succession.
    let debounceTimer = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doRefresh, 400);
    };

    // Always refresh from the API on mount so the TopNav balance stays
    // accurate after full page reloads.
    doRefresh();

    // ── Window / visibility events ──────────────────────────────────────
    // aura:wallet-updated can carry a balance in the detail — use it to
    // update local state directly (no API call, no debounce).
    const onWalletUpdatedEvent = (e) => {
      const b = Number(e?.detail?.balance);
      if (Number.isFinite(b)) {
        setLocalBalance(b);
        setWalletBalance(b);
      } else {
        refresh();
      }
    };
    window.addEventListener('aura:wallet-updated', onWalletUpdatedEvent);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

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
    const onWalletCredited = (data) => {
      if (data?.balance !== undefined && Number.isFinite(Number(data.balance))) {
        const b = Number(data.balance);
        setLocalBalance(b);
        setWalletBalance(b);
        broadcastBalance(b);
      } else {
        doRefresh();
      }
    };
    const onWithdrawalPaid = () => doRefresh();
    const onSocketConnect = () => doRefresh();

    socketService.on('connect', onSocketConnect);
    socketService.on('wallet:credited', onWalletCredited);
    socketService.on('wallet:debited', onWalletCredited);
    socketService.on('withdrawal:paid', onWithdrawalPaid);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('aura:wallet-updated', onWalletUpdatedEvent);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshWalletBalance]);

  // walletBalance: the display value (local state — always triggers re-render)
  const walletBalance = localBalance;
  const displayedBalance = Number(walletBalance ?? 0);

  return {
    walletBalance,
    displayedBalance,
    refreshWalletBalance,
    setWalletBalance: updateBalance,
  };
}
