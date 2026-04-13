/**
 * Seed realistic sample orders/shipments for existing users.
 *
 * Usage:
 *   node scripts/seed-real-users-samples.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Escrow = require('../models/Escrow.model');

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const customers = await User.find({ role: 'customer' }).limit(10);
  const vendors = await Vendor.find({ is_onboarded: true }).limit(10);
  const firms = await LogisticsCompany.find({ is_verified: true }).limit(10);
  const products = await Product.find({ status: 'active', stock: { $gt: 0 } }).limit(200);

  if (!customers.length || !vendors.length || !products.length) {
    throw new Error('Need existing customers, vendors and active products before seeding.');
  }

  const ordersToCreate = [];
  for (let i = 0; i < Math.min(20, customers.length * 2); i += 1) {
    const customer = randomFrom(customers);
    const vendor = randomFrom(vendors);
    const vendorProducts = products.filter((p) => String(p.vendor_id) === String(vendor._id));
    if (!vendorProducts.length) continue;

    const item = randomFrom(vendorProducts);
    const quantity = Math.max(1, Math.min(3, item.stock));
    const shippingFee = firms.length ? 1500 : 0;
    const total = item.price * quantity + shippingFee;
    const useLogistics = firms.length > 0 && Math.random() > 0.35;
    const firm = useLogistics ? randomFrom(firms) : null;

    ordersToCreate.push({
      customer_id: customer._id,
      vendor_id: vendor._id,
      products: [
        {
          product_id: item._id,
          name: item.name,
          quantity,
          price: item.price,
          image: item.images?.[0]?.url || item.images?.[0] || null,
        },
      ],
      subtotal: item.price * quantity,
      shipping_fee: shippingFee,
      total_amount: total,
      payment_method: 'escrow',
      payment_status: 'paid',
      shipping_method: useLogistics ? 'logistics_partner' : 'vendor_managed',
      logistics_company_id: firm?._id || null,
      shipping_address: {
        street: 'Main street',
        city: 'Douala',
        quartier: 'Akwa',
        country: 'Cameroon',
        phone: customer.phone || '670000000',
        email: customer.email,
      },
      order_status: useLogistics ? 'shipped' : 'processing',
      escrow_enabled: true,
    });
  }

  const createdOrders = await Order.insertMany(ordersToCreate);

  const escrows = createdOrders.map((o) => ({
    order_id: o._id,
    buyer_id: o.customer_id,
    vendor_id: o.vendor_id,
    amount: o.total_amount,
    status: 'held',
  }));
  await Escrow.insertMany(escrows, { ordered: false }).catch(() => {});

  const shipments = createdOrders
    .filter((o) => o.shipping_method === 'logistics_partner' && o.logistics_company_id)
    .map((o, idx) => ({
      order_id: o._id,
      vendor_id: o.vendor_id,
      logistics_id: o.logistics_company_id,
      status: 'assigned',
      tracking_code: `AURA-SAMPLE-${Date.now().toString().slice(-6)}-${idx}`,
      pickup_address: { city: 'Douala', quartier: 'Bonapriso', phone: '670000001' },
      delivery_address: { city: o.shipping_address?.city, quartier: o.shipping_address?.quartier, phone: o.shipping_address?.phone },
      price: o.shipping_fee || 0,
      shipment_logs: [{ status: 'assigned', note: 'Sample seeded shipment' }],
    }));
  if (shipments.length) {
    await Shipment.insertMany(shipments, { ordered: false }).catch(() => {});
  }

  console.log(`Seeded ${createdOrders.length} sample orders for real users.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
