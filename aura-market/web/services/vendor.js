import api from './api';

/**
 * vendorService
 * Logic for vendor onboarding, store management, and KYC.
 */
export const vendorService = {
  // Onboard as a vendor
  onboard: async (data) => {
    const res = await api.post('/vendors/onboard', data);
    return res.data;
  },

  // Get current vendor profile
  getProfile: async () => {
    const res = await api.get('/vendors/me');
    return res.data;
  },

  // Update store details
  updateStore: async (data) => {
    const res = await api.patch('/vendors/store', data);
    return res.data;
  },

  // Submit KYC documents
  submitKYC: async (kycData) => {
    const res = await api.post('/vendors/kyc', kycData);
    return res.data;
  },

  // Get public stores
  getPublicStores: async () => {
    const cacheKey = 'vendors_public_cache_v1';

    // Try to return fresh-ish cache immediately
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const age = Date.now() - (parsed.ts || 0);
          const FIVE_MIN = 5 * 60 * 1000;
          if (age < FIVE_MIN && parsed.data) {
            // Background refresh
            vendorService._refreshPublicStores(cacheKey).catch(() => {});
            return parsed.data;
          }
        }
      } catch (e) {
        // ignore cache parse errors
      }
    }

    // No valid cache — fetch and store
    const res = await api.get('/vendors');
    if (res?.data) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
        }
      } catch (e) {}
    }
    return res.data;
  },

  // Background refresher used when returning cache quickly
  _refreshPublicStores: async (cacheKey = 'vendors_public_cache_v1') => {
    try {
      const res = await api.get('/vendors');
      if (res?.data && typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
      }
      return res.data;
    } catch (e) {
      return null;
    }
  },

  // Get specific store
  getStore: async (id) => {
    const res = await api.get(`/vendors/stores/${id}`);
    return res.data;
  }
};
