import api from './api';

/**
 * paymentService
 * Handles gateway-specific operations for Eversend and PayUnit.
 */
export const paymentService = {
  // ── Eversend (Mobile Money / Cards) ───────────────────────────────────────
  
  /**
   * Request an OTP for a collection (if account is not yet whitelisted)
   */
  requestEversendOTP: async (phone) => {
    const res = await api.post('/payments/eversend/otp', { phone });
    return res.data;
  },

  /**
   * Initiate an Eversend payment collection.
   * @param {Object} data - { amount, currency, phone, country, order_ids, redirect_url, otp }
   */
  initializeEversend: async (data) => {
    // Eversend hard minimum for XAF is 500
    if (data.currency === 'XAF' && data.amount < 500) {
      throw new Error('Mobile Money requires at least 500 XAF for this payment route.');
    }
    const res = await api.post('/payments/eversend/initialize', data);
    return res.data;
  },

  /**
   * Verify an Eversend transaction status
   */
  verifyEversend: async (reference) => {
    const res = await api.get(`/payments/eversend/verify/${reference}`);
    return res.data;
  }
};
