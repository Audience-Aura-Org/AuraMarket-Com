import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * useAuthStore
 * Manages the global authentication state, user profile, and session tokens.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      rememberedEmail: '', // New field to keep track of the last logged-in email
      followedVendorIds: [], // Global list for instant checks
      isAuthenticated: false,
      hasHydrated: false,
      loading: false,
      error: null,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setRememberedEmail: (email) => set({ rememberedEmail: email }),

      // Login functionality
      login: async (credentials) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post('/auth/login', credentials);
          
          // Handle 2FA required
          if (res.data.two_factor_required) {
            set({ loading: false });
            return { 
              success: true, 
              twoFactorRequired: true, 
              userId: res.data.data.userId 
            };
          }

          const { token, data } = res.data;
          const { user } = data;
          set({ user, token, isAuthenticated: true, loading: false, rememberedEmail: user.email });
          localStorage.setItem('aura_token', token);
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Login failed';
          set({ error: message, loading: false });
          return { success: false, message };
        }
      },

      // Complete login with 2FA
      verify2FA: async (userId, token) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post('/auth/verify-2fa', { userId, token });
          const { token: jwtToken, data } = res.data;
          const { user } = data;
          
          set({ user, token: jwtToken, isAuthenticated: true, loading: false });
          localStorage.setItem('aura_token', jwtToken);
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || '2FA Verification failed';
          set({ error: message, loading: false });
          return { success: false, message };
        }
      },

      // Register functionality
      register: async (userData) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post('/auth/register', userData);
          const { token, data } = res.data;
          const { user } = data;
          
          set({ user, token, isAuthenticated: true, loading: false });
          localStorage.setItem('aura_token', token);
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Registration failed';
          set({ error: message, loading: false });
          return { success: false, message };
        }
      },

      // Logout functionality
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('aura_token');
        // Clear skip flag so onboarding reappears on next login
        sessionStorage.removeItem('onboarding_skipped');
      },

      // Update local user data (e.g., after wallet update)
      updateUser: (data) => {
        set((state) => ({
          user: { ...state.user, ...data }
        }));
      },

      // Fetch followed list for instant status across site
      fetchFollowedVendors: async () => {
        if (!get().isAuthenticated) return;
        try {
          const res = await api.get('/users/followed-vendors');
          if (res.data.success) {
            const ids = (res.data.data.follows || [])
              .map(f => f.vendor_id?._id || f.vendor_id)
              .filter(id => id != null)
              .map(id => id.toString());
            set({ followedVendorIds: ids });
          }
        } catch (err) {
          console.error('Failed to pre-fetch followed vendors:', err);
        }
      },

      // Optimistic updates for zero-flicker UI
      addFollowedVendor: (vendorId) => {
        const id = vendorId.toString();
        set((state) => ({
          followedVendorIds: state.followedVendorIds.includes(id) 
            ? state.followedVendorIds 
            : [...state.followedVendorIds, id]
        }));
      },

      removeFollowedVendor: (vendorId) => {
        const id = vendorId.toString();
        set((state) => ({
          followedVendorIds: state.followedVendorIds.filter(vId => vId !== id)
        }));
      }
    }),
    {
      name: 'aura-auth-storage', // persists to localStorage automatically
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated?.(true);
      },
    }
  )
);
