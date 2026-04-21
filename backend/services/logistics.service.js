/**
 * services/logistics.service.js
 * Aura Market — Logistics Module Service
 *
 * Handles tracking generation, firm filtering, and automated shipment splitting.
 */

const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Vendor = require('../models/Vendor.model');
const Order = require('../models/Order.model');
const mongoose = require('mongoose');

/**
 * Generates a unique tracking code in the format AURA-XXXXXX
 */
const generateTrackingCode = async () => {
  const prefix = 'AURA-';
  let isUnique = false;
  let code;

  while (!isUnique) {
    const random = Math.floor(100000 + Math.random() * 900000); // 6 digits
    code = `${prefix}${random}`;
    const existing = await Shipment.findOne({ tracking_code: code });
    if (!existing) isUnique = true;
  }
  return code;
};

/**
 * Filters logistics companies based on quartier support and vendor pickup regions
 */
const getCompatibleFirms = async (quartier, vendorIds) => {
  // 1. Get all vendors to find their pickup regions
  const vendors = await Vendor.find({ _id: { $in: vendorIds } });
  const pickupRegions = [...new Set(vendors.map(v => v.pickup_address?.region).filter(Boolean))];

  // 2. Find information about the target zone (case-insensitive)
  const LogisticZone = require('../models/LogisticZone.model');
  const targetZone = await LogisticZone.findOne({ name: new RegExp(`^${quartier}$`, 'i') }).populate('parent_id');
  const districtName = targetZone?.parent_id?.name;

  // 3. Find firms that:
  // - Are verified
  // - Have a price defined for the specific quartier OR its parent district (case-insensitive)
  const quartierPattern  = new RegExp(`^${quartier}$`, 'i');
  const districtPattern  = districtName ? new RegExp(`^${districtName}$`, 'i') : null;

  const query = {
    is_verified: true,
    $or: [
      { 'quartier_prices.quartier': quartierPattern }
    ]
  };

  if (districtPattern) {
    query.$or.push({ 'quartier_prices.quartier': districtPattern });
  }

  // Only filter by pickup regions if vendors have them set; don't exclude firms that haven't set this field
  if (pickupRegions.length > 0) {
    query.$or.push({ supported_pickup_regions: { $in: pickupRegions } });
    query.$or.push({ supported_pickup_regions: { $exists: false } });
    query.$or.push({ supported_pickup_regions: { $size: 0 } });
  }

  let firms = await LogisticsCompany.find(query).populate('user_id', 'name email avatar branding');
  
  // FALLBACK: If no strictly compatible firms found, return all verified firms 
  // to prevent checkout blockage.
  if (firms.length === 0) {
    firms = await LogisticsCompany.find({ is_verified: true }).populate('user_id', 'name email avatar branding');
  }

  return firms;
};

/**
 * Calculates shipping fees per vendor and total
 */
const calculateShipmentFees = async (vendors, quartier, logisticsId) => {
  const firm = await LogisticsCompany.findById(logisticsId);
  if (!firm) throw new Error('Logistics firm not found');

  let quartierPrice = firm.quartier_prices.find(p => p.quartier === quartier);
  
  if (!quartierPrice) {
    const LogisticZone = require('../models/LogisticZone.model');
    const targetZone = await LogisticZone.findOne({ name: quartier }).populate('parent_id');
    const districtName = targetZone?.parent_id?.name;
    if (districtName) {
      quartierPrice = firm.quartier_prices.find(p => p.quartier === districtName);
    }
  }

  if (!quartierPrice) throw new Error(`Zone ${quartier} is not mapped in this firm's pricing matrix.`);

  const perShipmentFee = quartierPrice.price;
  const totalFee = perShipmentFee * vendors.length;


  return { perShipmentFee, totalFee };
};

/**
 * Splits an order into shipments per vendor
 */
const createShipmentsForOrder = async (order, quartier, logisticsId, session = null) => {
  const { _id: orderId, customer_id, products, shipping_address } = order;

  // 1. Group products by vendor
  const productsByVendor = {};
  products.forEach(p => {
    const vId = p.vendor_id || order.vendor_id; // Support both per-product and per-order vendor
    if (!productsByVendor[vId]) productsByVendor[vId] = [];
    productsByVendor[vId].push(p);
  });

  const vendorIds = Object.keys(productsByVendor);
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).session(session);
  
  const { perShipmentFee } = await calculateShipmentFees(vendors, quartier, logisticsId);

  const shipments = [];
  for (const vendor of vendors) {
    const trackingCode = await generateTrackingCode();
    
    const shipmentData = {
      order_id: orderId,
      vendor_id: vendor._id,
      logistics_id: logisticsId,
      tracking_code: trackingCode,
      status: 'pending',
      price: perShipmentFee,
      pickup_address: {
        ...vendor.pickup_address,
        phone: vendor.phone
      },
      delivery_address: {
        ...shipping_address,
        quartier: quartier,
      },
      delivery_description: order.delivery_description || '',
      shipment_logs: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Shipment initialized automatically after order payment.'
      }]
    };

    const [shipment] = await Shipment.create([shipmentData], { session });
    shipments.push(shipment);
  }

  return shipments;
};

module.exports = {
  generateTrackingCode,
  getCompatibleFirms,
  calculateShipmentFees,
  createShipmentsForOrder
};
