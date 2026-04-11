import api from './api';

/**
 * addressService
 * Handles user shipping and billing addresses.
 */
export const addressService = {
  // Get all user addresses
  getAddresses: async () => {
    const res = await api.get('/addresses');
    return res.data;
  },

  // Add a new address
  addAddress: async (addressData) => {
    const res = await api.post('/addresses', addressData);
    return res.data;
  },

  // Update an existing address
  updateAddress: async (id, addressData) => {
    const res = await api.patch(`/addresses/${id}`, addressData);
    return res.data;
  },

  // Delete an address
  deleteAddress: async (id) => {
    const res = await api.delete(`/addresses/${id}`);
    return res.data;
  }
};
