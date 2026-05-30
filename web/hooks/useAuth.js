import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import socketService from '../services/socket';
import { clearStoredAuthToken, setStoredAuthToken } from '../services/authStorage';

const clearClientOnlyState = async () => {
  if (typeof window === 'undefined') return;
  await clearStoredAuthToken();
  sessionStorage.removeItem('onboarding_skipped');
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      rememberedEmail: '',
      followedVendorIds: [],
      isAuthenticated: false,
      hasHydrated: false,
      loading: false,
      error: null,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setRememberedEmail: (email) => set({ rememberedEmail: email }),

      sendOtp: async (email) => {
        set({ loading: true, error: null, rememberedEmail: email });
        try {
          const res = await api.post('/auth/send-otp', { email });
          set({ loading: false, error: null });
          return { success: true, data: res.data.data };
        } catch (err) {
          const message = err.response?.data?.message || 'Unable to send verification code';
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
          });

          if (res.data.signup_required) {
            set({ loading: false, error: null, rememberedEmail: email });
            return {
              success: true,
              signupRequired: true,
              signupToken: res.data.signupToken,
              email: res.data.data?.email || email,
            };
          }

          const { token, data } = res.data;
          const { user } = data;
          await setStoredAuthToken(token);
          set({
            user,
            token,
            isAuthenticated: true,
            loading: false,
            error: null,
            rememberedEmail: user.email,
          });
          return { success: true, user };
        } catch (err) {
          const message = err.response?.data?.message || 'Verification failed';
          set({ error: message, loading: false });
          return { success: false, message, retryAfter: err.response?.data?.retryAfter };
        }
      },

      fetchMe: async () => {
        if (get().loading) return { success: false };
        set({ loading: true });
        try {
          const res = await api.get('/auth/me');
          const user = res.data.data?.user;
          if (!user) throw new Error('No user returned');
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
            rememberedEmail: user.email,
          });
          return { success: true, user };
        } catch (err) {
          set({ user: null, token: null, isAuthenticated: false, loading: false });
          return { success: false };
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
            loading: false,
            error: null,
          });
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Account deletion failed';
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
          loading: false,
          error: null,
        });
      },

      updateUser: (data) => {
        set((state) => ({
          user: { ...state.user, ...data },
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
        rememberedEmail: state.rememberedEmail,
        followedVendorIds: state.followedVendorIds,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated?.(true);
      },
    }
  )
);
