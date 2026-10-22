'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import api from '@/services/api';

const balanceOf = (user) =>
  Number.isFinite(Number(user?.wallet_balance)) ? Number(user.wallet_balance) : null;

/**
 * The ActingAccountContext value for a managed account (see hooks/useAuth).
 *
 * Embedded pages put these helpers in effect/callback deps (e.g. the vendor
 * dashboard's load() depends on updateUser and writes the balance). So every
 * helper keeps one identity for the life of the workspace, and writing an
 * unchanged balance is a no-op — otherwise each load re-creates the helpers,
 * which re-runs the load: an endless reload loop (flickering skeletons,
 * hammered API, rate-limited empty pages).
 */
export function useActingAccount({ account: loaded, loadSession }) {
  const [account, setAccount] = useState(loaded);
  const [walletBalance, setWalletBalanceState] = useState(() => balanceOf(loaded));

  // Adopt a freshly loaded profile (account switch or fetchMe) during render.
  const [syncedFrom, setSyncedFrom] = useState(loaded);
  if (syncedFrom !== loaded) {
    setSyncedFrom(loaded);
    setAccount(loaded);
    setWalletBalanceState(balanceOf(loaded));
  }

  const loadSessionRef = useRef(loadSession);
  loadSessionRef.current = loadSession;

  const setWalletBalance = useCallback((balance) => {
    const n = Number(balance);
    if (!Number.isFinite(n)) return;
    // Only the balance: rewriting `user` would re-run every page effect keyed on
    // it. Same value → React bails out. Balances render from walletBalance.
    setWalletBalanceState(n);
  }, []);

  const updateUser = useCallback((data) => {
    setAccount((u) => (u ? { ...u, ...data } : u));
    const n = Number(data?.wallet_balance);
    if (data?.wallet_balance != null && Number.isFinite(n)) setWalletBalanceState(n);
  }, []);

  const refreshWalletBalance = useCallback(async () => {
    try {
      const res = await api.get('/wallet', { skipClientCache: true, __skipRetry: true });
      if (res.data?.success) {
        const balance = Number(res.data.data?.balance ?? 0);
        setWalletBalance(balance);
        return { success: true, balance };
      }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
    return { success: false };
  }, [setWalletBalance]);

  const fetchMe = useCallback((...args) => loadSessionRef.current?.(...args), []);

  return useMemo(() => {
    if (!account) return null;
    return { user: account, walletBalance, updateUser, setWalletBalance, refreshWalletBalance, fetchMe };
  }, [account, walletBalance, updateUser, setWalletBalance, refreshWalletBalance, fetchMe]);
}
