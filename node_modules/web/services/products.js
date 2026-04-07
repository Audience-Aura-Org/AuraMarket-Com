import api from './api';

/**
 * productService
 * Handle CRUD operations for product listings.
 */
export const productService = {
  // Get all products (supports discovery filters)
  getAll: async (params = {}) => {
    const res = await api.get('/products', { params });
    return res.data;
  },

  // Get single product details
  getById: async (id) => {
    const res = await api.get(`/products/${id}`);
    return res.data;
  },

  // Create a new product (Vendor only)
  create: async (productData) => {
    const res = await api.post('/products', productData);
    return res.data;
  },

  // Update product (Vendor only)
  update: async (id, productData) => {
    const res = await api.patch(`/products/${id}`, productData);
    return res.data;
  },

  // Delete/Archive product (Vendor only)
  delete: async (id) => {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  }
};
