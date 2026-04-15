import api from './api';

/**
 * disputeService
 * Logic for buyers and vendors to contest orders.
 */
export const disputeService = {
  // Open a new dispute case
  openDispute: async (disputeData) => {
    const res = await api.post('/disputes', disputeData);
    return res.data;
  },

  // Get current user's disputes
  getMyDisputes: async () => {
    const res = await api.get('/disputes/me');
    return res.data;
  }
};
