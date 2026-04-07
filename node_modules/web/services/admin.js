import api from './api';

/**
 * adminService
 * Platform-wide management functions reserved for Admins.
 */
export const adminService = {
  // Fetch platform analytics (stats, volume, counts)
  getAnalytics: async () => {
    const res = await api.get('/admin/analytics');
    return res.data;
  },

  // Update hero banners on the homepage
  updateBanners: async (banners) => {
    const res = await api.patch('/admin/homepage/banners', { hero_banners: banners });
    return res.data;
  },

  // Hand-pick featured products for the discovery feed
  setFeaturedProducts: async (featuredItems) => {
    const res = await api.patch('/admin/homepage/featured', { featured_products: featuredItems });
    return res.data;
  },

  // Toggle vendor "Verified" status
  verifyVendor: async (vendorId, status) => {
    const res = await api.patch(`/admin/vendors/${vendorId}/verify`, { verified: status });
    return res.data;
  },

  // Get pending KYC submissions
  getPendingKYC: async () => {
    const res = await api.get('/admin/kyc/pending');
    return res.data;
  },

  // Approve or reject KYC
  reviewKYC: async (id, status, feedback) => {
    const res = await api.patch(`/admin/kyc/${id}/review`, { status, feedback });
    return res.data;
  },

  // Get all active disputes
  getDisputes: async () => {
    const res = await api.get('/admin/disputes');
    return res.data;
  },

  // Resolve a dispute
  resolveDispute: async (id, resolutionData) => {
    const res = await api.patch(`/admin/disputes/${id}/resolve`, resolutionData);
    return res.data;
  },

  // Get pending reports
  getReports: async () => {
    const res = await api.get('/admin/reports');
    return res.data;
  },

  // Mark report as actioned/dismissed
  resolveReport: async (id, status, admin_notes) => {
    const res = await api.patch(`/admin/reports/${id}/resolve`, { status, admin_notes });
    return res.data;
  },

  // Get platform settings
  getSettings: async () => {
    const res = await api.get('/admin/settings');
    return res.data;
  },

  // Update platform settings
  updateSettings: async (settings) => {
    const res = await api.patch('/admin/settings', settings);
    return res.data;
  }
};
