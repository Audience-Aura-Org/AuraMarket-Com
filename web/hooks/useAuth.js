import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import socketService from '../services/socket';
import { clearStoredAuthToken, setStoredAuthToken } from '../services/authStorage';
import { unsubscribeCurrentPushEndpoint } from '../lib/pwa-helper';
import { unregisterNativeAndroidPushToken } from '../lib/native-push';

let fetchMeInFlight = null;
let lastFetchMeFailureAt = 0;
const FETCH_ME_FAILURE_COOLDOWN_MS = 30000;

const clearClientOnlyState = async () => {
  if (typeof window === 'undefined') return;
  await unsubscribeCurrentPushEndpoint({ removeBrowserSubscription: true }).catch(() => {});
  await unregisterNativeAndroidPushToken().catch(() => {});
  await api.post('/auth/logout', {}, {
    __skipRetry: true,
  }).catch(() => {});
  await clearStoredAuthToken();
  localStorage.removeItem('aura-auth-storage');
  sessionStorage.removeItem('onboarding_skipped');
};

const isTerminalSessionError = (err) => {
  const status = err?.response?.status;
  const message = String(err?.response?.data?.message || err?.message || '').toLowerCase();
  if (status === 401) {
    return (
      message.includes('user belonging to this token no longer exists') ||
      message.includes('session is no longer valid') ||
      message.includes('jwt expired') ||
      message.includes('invalid token')
    );
  }

  return status === 403 && message.includes('deactivated');
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      rememberedEmail: '',
      followedVendorIds: [],
      walletBalance: null,
      isAuthenticated: false,
      hasHydrated: false,
      authChecked: false,
      loading: false,
      error: null,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setRememberedEmail: (email) => set({ rememberedEmail: email }),
      resetLoading: () => set({ loading: false, error: null }),
      setWalletBalance: (balance) => {
        const numericBalance = Number(balance);
        if (!Number.isFinite(numericBalance)) return;
        set((state) => ({
          walletBalance: numericBalance,
          user: state.user ? { ...state.user, wallet_balance: numericBalance } : state.user,
        }));
      },
      refreshWalletBalance: async () => {
        if (!get().isAuthenticated && !get().user?._id) return { success: false };
        try {
          const res = await api.get('/wallet', {
            timeout: 12000,
            __skipRetry: true,
          });
          if (res.data?.success) {
            const balance = Number(res.data.data?.balance ?? 0);
            get().setWalletBalance(balance);
            return { success: true, balance };
          }
        } catch (err) {
          return { success: false, message: err.response?.data?.message || err.message };
        }
        return { success: false };
      },

      sendOtp: async (email) => {
        set({ loading: true, error: null, rememberedEmail: email });
        try {
          const res = await api.post('/auth/send-otp', { email }, {
            timeout: 60000,
            __skipRetry: true,
          });
          set({ loading: false, error: null });
          return { success: true, data: res.data.data };
        } catch (err) {
          const message = err.code === 'ECONNABORTED'
            ? 'The code request took too long. Please check your connection and try again.'
            : err.response?.data?.message || 'Unable to send verification code';
          set({ error: message, loading: false });
          return { success: false, message, retryAfter: err.response?.data?.retryAfter };
        }
      },

      verifyOtp: async ({ email, otp, signupToken, name, phone, role, referral_code, onboarding }) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post('/auth/verify-otp', {
            email,
            otp,
            signupToken,
            name,
            phone,
            role,
            referral_code,
            onboarding,
          }, {
            timeout: 60000,
            __skipRetry: true,
          });

          console.log('[useAuth] ===== API verifyOtp FULL RESPONSE =====');
          console.log('[useAuth] Status:', res.status);
          console.log('[useAuth] Entire res.data:', JSON.stringify(res.data, null, 2));
          console.log('[useAuth] res.data.token exists?', !!res.data?.token);
          console.log('[useAuth] res.data.data?.token exists?', !!res.data?.data?.token);
          console.log('[useAuth] ===== END RESPONSE =====');

          const signupRequired =
            Boolean(res.data?.signup_required) ||
            Boolean(res.data?.signupRequired) ||
            Boolean(res.data?.data?.signup_required) ||
            Boolean(res.data?.data?.signupRequired) ||
            Boolean((res.data?.signupToken || res.data?.data?.signupToken) && !res.data?.data?.user && !res.data?.user);

          if (signupRequired) {
            const verifiedEmail = res.data?.data?.email || res.data?.email || email;
            set({ loading: false, error: null, rememberedEmail: verifiedEmail });
            return {
              success: true,
              signupRequired: true,
              signupToken: res.data?.signupToken || res.data?.data?.signupToken,
              email: verifiedEmail,
            };
          }

          const token = res.data?.token || res.data?.data?.token || null;
          const user = res.data?.data?.user || res.data?.user || null;
          
          console.log('[useAuth] OTP verification response - token:', token ? 'present' : 'NULL');
          console.log('[useAuth] OTP verification response - user:', user?.email || 'null');
          
          if (!user) {
            throw new Error('No user returned after verification.');
          }
          const previousUserId = get().user?._id?.toString?.();
          if (previousUserId && previousUserId !== user?._id?.toString?.()) {
            socketService.disconnect();
            await unsubscribeCurrentPushEndpoint({ removeBrowserSubscription: true }).catch(() => {});
          }
          await setStoredAuthToken(token);
          set({
            user,
            walletBalance: Number.isFinite(Number(user.wallet_balance)) ? Number(user.wallet_balance) : get().walletBalance,
            token,
            isAuthenticated: true,
            authChecked: true,
            loading: false,
            error: null,
            rememberedEmail: user.email,
          });
          return { success: true, user };
        } catch (err) {
          const message = err.code === 'ECONNABORTED'
            ? 'Verification took too long. Please try again.'
            : err.response?.data?.message || 'Verification failed';
          set({ error: message, loading: false });
          return { success: false, message, retryAfter: err.response?.data?.retryAfter };
        }
      },

      fetchMe: async ({ force = false } = {}) => {
        if (fetchMeInFlight) return fetchMeInFlight;
        if (get().loading) return { success: false };
        if (!force && get().authChecked && !get().user) return { success: false, alreadyChecked: true };

        const now = Date.now();
        if (!force && lastFetchMeFailureAt && now - lastFetchMeFailureAt < FETCH_ME_FAILURE_COOLDOWN_MS) {
          return { success: false, coolingDown: true };
        }

        set({ loading: true });
        fetchMeInFlight = (async () => {
          const res = await api.get('/auth/me', {
            timeout: 12000,
            __skipRetry: true,
          });
          const user = res.data.data?.user;
          if (!user) throw new Error('No user returned');
          set({
            user,
            walletBalance: Number.isFinite(Number(user.wallet_balance)) ? Number(user.wallet_balance) : get().walletBalance,
            isAuthenticated: true,
            authChecked: true,
            loading: false,
            error: null,
            rememberedEmail: user.email,
          });
          lastFetchMeFailureAt = 0;
          return { success: true, user };
        })();

        try {
          return await fetchMeInFlight;
        } catch (err) {
          lastFetchMeFailureAt = Date.now();
          if (isTerminalSessionError(err)) {
            await clearClientOnlyState();
            set({ user: null, token: null, isAuthenticated: false, authChecked: true, loading: false });
            return { success: false, invalidSession: true };
          }
          // Non-terminal failure (network error, 5xx, temporary outage).
          // Do NOT clear isAuthenticated — the user's token is still valid.
          // Clearing it would log them out on every server blip or
          // cold-start before the token finishes loading from native storage.
          set({ authChecked: true, loading: false });
          return { success: false };
        } finally {
          fetchMeInFlight = null;
        }
      },

      deleteAccount: async (confirmText) => {
        set({ loading: true, error: null });
        try {
          await api.post('/auth/delete-account', { confirmText });
          socketService.disconnect();
          await clearClientOnlyState();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            followedVendorIds: [],
            walletBalance: null,
            authChecked: true,
            loading: false,
            error: null,
          });
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Account deletion failed';
          if (isTerminalSessionError(err)) {
            socketService.disconnect();
            await clearClientOnlyState();
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              followedVendorIds: [],
              walletBalance: null,
              authChecked: true,
              loading: false,
              error: null,
            });
            return { success: true, alreadyDeleted: true };
          }
          set({ error: message, loading: false });
          return { success: false, message };
        }
      },

      // Kept only as an internal compatibility escape hatch while old components are removed.
      logout: async () => {
        socketService.disconnect();
        await clearClientOnlyState();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          followedVendorIds: [],
          walletBalance: null,
          authChecked: true,
          loading: false,
          error: null,
        });
      },

      updateUser: (data) => {
        const nextBalance = Number.isFinite(Number(data?.wallet_balance))
          ? Number(data.wallet_balance)
          : get().walletBalance;
        set((state) => ({
          user: { ...state.user, ...data },
          walletBalance: nextBalance,
        }));
      },

      fetchFollowedVendors: async () => {
        if (!get().isAuthenticated) return;
        try {
          const res = await api.get('/users/followed-vendors');
          if (res.data.success) {
            const ids = (res.data.data.follows || [])
              .map((f) => f.vendor_id?._id || f.vendor_id)
              .filter((id) => id != null)
              .map((id) => id.toString());
            set({ followedVendorIds: ids });
          }
        } catch (err) {
          console.error('Failed to pre-fetch followed vendors:', err);
        }
      },

      addFollowedVendor: (vendorId) => {
        const id = vendorId.toString();
        set((state) => ({
          followedVendorIds: state.followedVendorIds.includes(id)
            ? state.followedVendorIds
            : [...state.followedVendorIds, id],
        }));
      },

      removeFollowedVendor: (vendorId) => {
        const id = vendorId.toString();
        set((state) => ({
          followedVendorIds: state.followedVendorIds.filter((vId) => vId !== id),
        }));
      },
    }),
    {
      name: 'aura-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        rememberedEmail: state.rememberedEmail,
        followedVendorIds: state.followedVendorIds,
        walletBalance: state.walletBalance,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated?.(true);
      },
    }
  )
);
