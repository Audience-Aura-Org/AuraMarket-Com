import api from './api';

/**
 * paymentService
 * Handles gateway-specific operations for Paystack.
 */
export const paymentService = {
  // Get Paystack checkout URL
  initializeDeposit: async (amount) => {
    const res = await api.post('/payments/initialize', { amount });
    return res.data;
  },

  // Verify payment status after redirect
  verifyDeposit: async (reference) => {
    const res = await api.get(`/payments/verify/${reference}`);
    return res.data;
  }
};
