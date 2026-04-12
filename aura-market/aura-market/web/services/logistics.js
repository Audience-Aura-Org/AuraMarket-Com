import api from './api';

/**
 * logisticsService
 * Logic for connecting with delivery firms and tracking shipments.
 */
export const logisticsService = {
  // Onboard as a logistics partner
  onboard: async (data) => {
    const res = await api.post('/logistics/onboard', data);
    return res.data;
  },

  // Create a shipment ticket (Vendor only)
  createShipment: async (shipmentData) => {
    const res = await api.post('/logistics/shipments', shipmentData);
    return res.data;
  },

  // Get active shipments for a firm (Logistics only)
  getFirmShipments: async () => {
    const res = await api.get('/logistics/shipments/firm');
    return res.data;
  },

  // Update tracking status (Logistics only)
  updateStatus: async (id, statusData) => {
    const res = await api.patch(`/logistics/shipments/${id}/status`, statusData);
    return res.data;
  }
};
