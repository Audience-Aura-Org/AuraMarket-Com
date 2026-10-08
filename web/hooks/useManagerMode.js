'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * useManagerMode — Zustand store for the manager workspace.
 *
 * Manages:
 *   - accounts:  full list of assigned accounts (from GET /manager/accounts)
 *   - actAsId:   the user ID the manager is currently acting as
 *                 Synced to sessionStorage so it survives page reloads
 *                 but is scoped to the current tab. NOT stored in localStorage.
 *   - recent:    recently-visited accounts for quick switching (persisted per manager)
 *   - starred:   pinned accounts for quick access (persisted per manager, max 10)
 *   - switching: true while a workspace switch is in progress (shows progress bar)
 */

let accountsInFlight = null;
let badgeRefreshTimer = null;

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

      /** Recently visited accounts for quick switching (max 5). */
      recent: [],

      /** Starred/pinned accounts for quick access (max 10). */
      starred: [],

      /** True while switching workspaces (progress bar). */
      switching: false,

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
        const entry = account
          ? { id: account.id, name: account.name, role: account.role, email: account.email }
          : { id: userId };
        const newRecent = [
          entry,
          ...recent.filter((r) => r.id !== userId),
        ].slice(0, 5);

        writeActAsId(userId);
        set({ actAsId: userId, recent: newRecent });
      },

      /** Clear the act-as context (return to manager space). */
      clearActAs: () => {
        writeActAsId(null);
        set({ actAsId: null, switching: false });
      },

      /** Set switching state (progress bar). */
      setSwitching: (v) => set({ switching: !!v }),

      /**
       * Toggle starred status for an account.
       * Max 10 starred accounts.
       */
      toggleStar: (accountId) => {
        const { starred, accounts } = get();
        const isStarred = starred.some((s) => s.id === accountId);
        if (isStarred) {
          set({ starred: starred.filter((s) => s.id !== accountId) });
        } else if (starred.length < 10) {
          const account = accounts.find((a) => a.id === accountId);
          if (account) {
            set({
              starred: [
                ...starred,
                { id: account.id, name: account.name, role: account.role, email: account.email },
              ],
            });
          }
        }
      },

      /** Check if an account is starred. */
      isStarred: (accountId) => get().starred.some((s) => s.id === accountId),

      /**
       * Remove an account from recent and starred (e.g. when access is revoked).
       */
      removeAccount: (accountId) => {
        const { recent, starred, actAsId } = get();
        const updates = {
          recent: recent.filter((r) => r.id !== accountId),
          starred: starred.filter((s) => s.id !== accountId),
        };
        if (actAsId === accountId) {
          writeActAsId(null);
          updates.actAsId = null;
          updates.switching = false;
        }
        set(updates);
      },

      /**
       * Refresh task badge counts for all accounts.
       * Called on panel open, every 60s, and on socket events.
       */
      refreshBadges: async () => {
        try {
          const res = await api.get('/manager/accounts', {
            timeout: 10000,
            __skipRetry: true,
          });
          const accounts = res.data?.data || [];
          set({ accounts });
        } catch {
          // silent — badges are a nice-to-have
        }
      },

      /**
       * Start the 60-second badge refresh interval.
       */
      startBadgePolling: () => {
        if (badgeRefreshTimer) return;
        badgeRefreshTimer = setInterval(() => {
          if (typeof document !== 'undefined' && !document.hidden) {
            get().refreshBadges();
          }
        }, 60000);
      },

      /** Stop badge polling. */
      stopBadgePolling: () => {
        if (badgeRefreshTimer) {
          clearInterval(badgeRefreshTimer);
          badgeRefreshTimer = null;
        }
      },

      /** Clear everything (logout or role change). */
      reset: () => {
        writeActAsId(null);
        if (badgeRefreshTimer) {
          clearInterval(badgeRefreshTimer);
          badgeRefreshTimer = null;
        }
        set({
          accounts: [],
          loading: false,
          loaded: false,
          error: null,
          actAsId: null,
          recent: [],
          starred: [],
          switching: false,
        });
      },
    }),
    {
      name: 'aura-manager-mode',
      partialize: (state) => ({
        // Only persist recently visited and starred accounts
        recent: state.recent,
        starred: state.starred,
      }),
    }
  )
);
