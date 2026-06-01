import api from './api';

const PUBLIC_STORE_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

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
  getPublicStores: async (page = 1) => {
    const cacheKey = `vendors_public_cache_p${page}_v1`;

    // Try to return fresh-ish cache immediately
    if (typeof window !== 'undefined' && page === 1) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const age = Date.now() - (parsed.ts || 0);
          if (age < PUBLIC_STORE_CACHE_TTL_MS && parsed.data) {
            // Background refresh
            vendorService._refreshPublicStores(page, cacheKey).catch(() => {});
            return parsed.data;
          }
        }
      } catch (e) {
        // ignore cache parse errors
      }
    }

    // No valid cache — fetch and store
    const res = await api.get('/vendors', { params: { page, limit: 20 } });
    if (res?.data) {
      try {
        if (typeof window !== 'undefined' && page === 1) {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
        }
      } catch (e) {}
    }
    return res.data;
  },

  // Background refresher used when returning cache quickly
  _refreshPublicStores: async (page = 1, cacheKey = 'vendors_public_cache_v1') => {
    try {
      const res = await api.get('/vendors', { params: { page, limit: 20 } });
      if (res?.data && typeof window !== 'undefined' && page === 1) {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
      }
      return res.data;
    } catch (e) {
      return null;
    }
  },

  // Get specific store
  getStore: async (id) => {
    const cacheKey = `vendor_store_cache_${id}_v1`;
    if (typeof window !== 'undefined' && id) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const age = Date.now() - (parsed.ts || 0);
          if (age < PUBLIC_STORE_CACHE_TTL_MS && parsed.data) {
            api.get(`/vendors/stores/${id}`).then((res) => {
              if (res?.data) localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
            }).catch(() => {});
            return parsed.data;
          }
        }
      } catch (e) {}
    }

    const res = await api.get(`/vendors/stores/${id}`);
    if (res?.data && typeof window !== 'undefined' && id) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: res.data }));
      } catch (e) {}
    }
    return res.data;
  }
};
