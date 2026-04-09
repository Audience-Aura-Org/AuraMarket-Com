const logisticsController = require('./backend/controllers/logistics.controller');
console.log('Logistics Controller Exports:', Object.keys(logisticsController));

const {
  onboardLogistics,
  getFirmShipments,
  getVendorShipments,
  modifyShipmentStatus,
  getPublicLogisticsFirms,
  getZones,
  getSearchCompatibleFirms
} = logisticsController;

console.log('onboardLogistics:', typeof onboardLogistics);
console.log('getFirmShipments:', typeof getFirmShipments);
console.log('getVendorShipments:', typeof getVendorShipments);
console.log('modifyShipmentStatus:', typeof modifyShipmentStatus);
console.log('getPublicLogisticsFirms:', typeof getPublicLogisticsFirms);
console.log('getZones:', typeof getZones);
console.log('getSearchCompatibleFirms:', typeof getSearchCompatibleFirms);
