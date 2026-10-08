'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * useManagerMode — Zustand store for the manager workspace.
 *
 * Manages:
 *   - accounts: full list of assigned accounts (from GET /manager/accounts)
 *   - actAsId:  the user ID the manager is currently acting as
 *               Synced to sessionStorage so it survives page reloads
 *               but is scoped to the current tab.
 *   - recent:   recently-visited accounts for quick switching (persisted)
 */

let accountsInFlight = null;

/** Read actAsId from sessionStorage (tab-scoped). */
const readActAsId = () => {
  try { return sessionStorage.getItem('aura-act-as') || null; } catch { return null; }
};

/** Write actAsId to sessionStorage (tab-scoped). */
const writeActAsId = (id) => {
  try {
    if (id) sessionStorage.setItem('aura-act-as', id);
    else sessionStorage.removeItem('aura-act-as');
  } catch {}
};

export const useManagerMode = create(
  persist(
    (set, get) => ({
      accounts: [],
      loading: false,
      loaded: false,
      error: null,

      /**
       * Currently acting-as user ID.
       * Hydrated from sessionStorage on init so it survives page reloads.
       */
      actAsId: typeof window !== 'undefined' ? readActAsId() : null,

      /** Recently visited accounts for quick switching. */
      recent: [],

      /**
       * Load all assigned accounts from the manager API.
       * De-duplicates in-flight requests.
       */
      loadAccounts: async ({ force = false } = {}) => {
        if (accountsInFlight && !force) return accountsInFlight;

        const { loaded } = get();
        if (!force && loaded) return { success: true, cached: true };

        set({ loading: true, error: null });

        accountsInFlight = (async () => {
          try {
            const res = await api.get('/manager/accounts', {
              timeout: 15000,
              __skipRetry: true,
            });
            const accounts = res.data?.data || [];

            set({
              accounts,
              loading: false,
              loaded: true,
              error: null,
            });

            return { success: true, accounts };
          } catch (err) {
            const message =
              err.response?.data?.message || err.message || 'Failed to load accounts';
            set({ loading: false, loaded: true, error: message });
            return { success: false, message };
          } finally {
            accountsInFlight = null;
          }
        })();

        return accountsInFlight;
      },

      /**
       * Set the active act-as user ID (called from workspace layout).
       * Adds the account to the recent list.
       */
      setActAs: (userId) => {
        if (!userId) {
          writeActAsId(null);
          return set({ actAsId: null });
        }

        const { accounts, recent } = get();
        const account = accounts.find((a) => a.id === userId);

        // Build updated recent list (max 5, no duplicates)
        const newRecent = [
          ...(account
            ? [{ id: account.id, name: account.name, role: account.role }]
            : [{ id: userId }]),
          ...recent.filter((r) => r.id !== userId),
        ].slice(0, 5);

        writeActAsId(userId);
        set({ actAsId: userId, recent: newRecent });
      },

      /** Clear the act-as context (return to manager space). */
      clearActAs: () => {
        writeActAsId(null);
        set({ actAsId: null });
      },

      /** Clear everything (logout or role change). */
      reset: () => {
        writeActAsId(null);
        set({
          accounts: [],
          loading: false,
          loaded: false,
          error: null,
          actAsId: null,
          recent: [],
        });
      },
    }),
    {
      name: 'aura-manager-mode',
      partialize: (state) => ({
        // Only persist recently visited accounts
        recent: state.recent,
      }),
    }
  )
);
