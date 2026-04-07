import api from './api';

/**
 * orderService & escrowService
 * Logic for creating orders, paying from wallet, and managing escrow releases.
 */
export const orderService = {
  // Create a new order (pending payment)
  createOrder: async (orderData) => {
    const res = await api.post('/orders', orderData);
    return res.data;
  },

  // Process payment using wallet balance (Triggers Escrow)
  payForOrder: async (orderId) => {
    const res = await api.post(`/wallet/pay/${orderId}`);
    return res.data;
  },

  // Get user's order history
  getMyOrders: async (role = 'customer') => {
    const endpoint = role === 'vendor' ? '/orders/vendor/my-orders' : '/orders/my-orders';
    const res = await api.get(endpoint);
    return res.data;
  },

  // Get single order
  getOrder: async (id) => {
    const res = await api.get(`/orders/${id}`);
    return res.data;
  },

  // Request refund (Buyer)
  requestRefund: async (id, data) => {
    const res = await api.post(`/orders/${id}/refund`, data);
    return res.data;
  },

  // Approve refund (Vendor)
  approveRefund: async (id) => {
    const res = await api.patch(`/orders/${id}/approve-refund`);
    return res.data;
  },

  // Download invoice
  downloadInvoice: async (id) => {
    const res = await api.get(`/orders/${id}/invoice`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

export const escrowService = {
  // Customer confirms delivery -> Funds released to Vendor
  confirmAndRelease: async (orderId) => {
    const res = await api.post(`/escrow/release/${orderId}`);
    return res.data;
  }
};
