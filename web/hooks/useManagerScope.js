import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * useManagerScope — Zustand store for manager scope context.
 *
 * Tracks the manager's portfolio (assigned accounts) and the
 * currently selected account for filtering admin views.
 *
 * When `activeAccountId` is null the manager sees all assigned accounts.
 * When set, downstream queries filter to that single user.
 */

let portfolioInFlight = null;

export const useManagerScope = create(
  persist(
    (set, get) => ({
      /** Portfolio data from GET /admin/portfolio */
      assignments: [],
      stats: null,

      /** Which account the manager is currently focused on (null = all) */
      activeAccountId: null,

      /** Loading / error state */
      loading: false,
      error: null,
      lastFetchedAt: null,

      /**
       * Fetch portfolio from the backend.
       * De-duplicates in-flight requests.
       */
      fetchPortfolio: async ({ force = false } = {}) => {
        if (portfolioInFlight && !force) return portfolioInFlight;

        // Skip if fetched recently (within 2 minutes) unless forced
        const { lastFetchedAt } = get();
        if (!force && lastFetchedAt && Date.now() - lastFetchedAt < 120_000) {
          return { success: true, cached: true };
        }

        set({ loading: true, error: null });

        portfolioInFlight = (async () => {
          try {
            const res = await api.get('/admin/portfolio', {
              timeout: 15000,
              __skipRetry: true,
            });
            const data = res.data?.data || res.data;
            const assignments = data.assignments || [];
            const stats = data.stats || null;

            // If the active account was removed from assignments, reset it
            const { activeAccountId } = get();
            const validIds = assignments.map((a) => a.user_id?._id || a.user_id);
            const stillValid = !activeAccountId || validIds.includes(activeAccountId);

            set({
              assignments,
              stats,
              activeAccountId: stillValid ? activeAccountId : null,
              loading: false,
              error: null,
              lastFetchedAt: Date.now(),
            });

            return { success: true, assignments, stats };
          } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to load portfolio';
            set({ loading: false, error: message });
            return { success: false, message };
          } finally {
            portfolioInFlight = null;
          }
        })();

        return portfolioInFlight;
      },

      /** Switch the active account (null = all assigned accounts) */
      setActiveAccount: (userId) => {
        set({ activeAccountId: userId || null });
      },

      /** Clear everything (on logout or role change) */
      reset: () => {
        set({
          assignments: [],
          stats: null,
          activeAccountId: null,
          loading: false,
          error: null,
          lastFetchedAt: null,
        });
      },
    }),
    {
      name: 'aura-manager-scope',
      partialize: (state) => ({
        activeAccountId: state.activeAccountId,
      }),
    }
  )
);
