import api from './api';

/**
 * paymentService
 * Handles gateway-specific operations for Paystack and Eversend.
 */
export const paymentService = {
  // ── Paystack (Legacy) ──────────────────────────────────────────────────────
  initializeDeposit: async (amount) => {
    const res = await api.post('/payments/initialize', { amount });
    return res.data;
  },

  verifyDeposit: async (reference) => {
    const res = await api.get(`/payments/verify/${reference}`);
    return res.data;
  },

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
      throw new Error('Eversend requires a minimum of 500 XAF for processing.');
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
