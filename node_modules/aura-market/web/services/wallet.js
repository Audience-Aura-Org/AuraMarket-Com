import api from './api';

/**
 * walletService
 * Functional logic for interacting with the Aura Wallet backend system.
 */
export const walletService = {
  // Get current user's wallet balance
  getBalance: async () => {
    const res = await api.get('/wallet/balance');
    return res.data;
  },

  // Get transaction history
  getTransactions: async (params = {}) => {
    const res = await api.get('/wallet/transactions', { params });
    return res.data;
  },

  // Request a withdrawal (requires admin approval)
  requestWithdrawal: async (amount, payment_method) => {
    const res = await api.post('/wallet/withdraw', { amount, payment_method });
    return res.data;
  },

  // Simulate a deposit (Dev only)
  simulateDeposit: async (amount) => {
    const res = await api.post('/wallet/deposit', { amount });
    return res.data;
  }
};
