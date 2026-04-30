import api from './api';

/**
 * walletService
 * Functional logic for interacting with the Aura Wallet backend system.
 */
export const walletService = {
  // GET /api/wallet — returns { balance, pending_escrow }
  getBalance: async () => {
    const res = await api.get('/wallet');
    return res.data;
  },

  // GET /api/wallet/transactions
  getTransactions: async (params = {}) => {
    const res = await api.get('/wallet/transactions', { params });
    return res.data;
  },

  // POST /api/wallet/withdraw — { amount, method, details }
  requestWithdrawal: async (amount, method, details = {}) => {
    const res = await api.post('/wallet/withdraw', { amount, method, details });
    return res.data;
  },

  // POST /api/wallet/deposit — simulated
  simulateDeposit: async (amount) => {
    const res = await api.post('/wallet/deposit', { amount });
    return res.data;
  },

  // POST /api/wallet/pay-order
  payWithWallet: async (order_id) => {
    const res = await api.post('/wallet/pay-order', { order_id });
    return res.data;
  },
};
