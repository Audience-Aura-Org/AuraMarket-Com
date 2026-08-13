/**
 * scripts/create_burger_lab_order.js
 * Creates a single pending_acceptance food order at Burger Lab Yaoundé
 * for the customer brandonasah11@gmail.com
 *
 * Run: node backend/scripts/create_burger_lab_order.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

require('../models/Category.model');
require('../models/UserSubscription.model');
require('../models/Store.model');
require('../models/Shipment.model');
require('../models/Escrow.model');
require('../models/LogisticZone.model');

const Order   = require('../models/Order.model');
const Product = require('../models/Product.model');
const Vendor  = require('../models/Vendor.model');
const User    = require('../models/User.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('[CREATE_ORDER] Connected to MongoDB');

  // Find customer
  const customer = await User.findOne({ email: 'brandonasah11@gmail.com' }).lean();
  if (!customer) throw new Error('Customer brandonasah11@gmail.com not found');
  console.log(`[CREATE_ORDER] Customer: ${customer.email} (${customer._id})`);

  // Find Burger Lab
  const vendor = await Vendor.findOne({ store_name: /burger lab/i }).lean();
  if (!vendor) throw new Error('Burger Lab vendor not found');
  console.log(`[CREATE_ORDER] Vendor: ${vendor.store_name} (${vendor._id})`);

  // Find a product from Burger Lab
  const product = await Product.findOne({ vendor_id: vendor._id, price: { $gt: 0 } }).lean();
  if (!product) throw new Error('No product found for Burger Lab');
  console.log(`[CREATE_ORDER] Product: ${product.name} @ ${product.price} XAF`);

  const imageUrl = Array.isArray(product.images)
    ? (typeof product.images[0] === 'object' ? product.images[0]?.url : product.images[0]) || null
    : product.images || null;

  const order = await Order.create({
    customer_id:   customer._id,
    vendor_id:     vendor._id,
    products: [{
      product_id:    product._id,
      name:          product.name,
      quantity:      2,
      price:         product.price,
      regular_price: product.regular_price || product.price,
      sale_price:    product.sale_price || null,
      image:         imageUrl,
      variant:       null,
    }],
    subtotal:        product.price * 2,
    shipping_fee:    0,
    total_amount:    product.price * 2,
    payment_method:  'pay_on_delivery',
    payment_status:  'pending',
    order_status:    'placed',
    food_status:     'pending_acceptance',
    fulfilment_type: 'delivery',
    shipping_method: 'vendor_managed',
    escrow_enabled:  false,
    new_restaurant_hold: false,
    acceptance_deadline: new Date(Date.now() + 15 * 60_000),
    shipping_address: {
      street:  'Rue Nachtigal',
      city:    'Yaoundé',
      region:  'Centre',
      country: 'Cameroon',
      phone:   customer.phone || '+237600000002',
    },
    status_logs: [
      { status: 'placed',             note: 'Order placed',         timestamp: new Date(Date.now() - 60_000) },
      { status: 'pending_acceptance', note: 'Awaiting restaurant',  timestamp: new Date() },
    ],
  });

  console.log(`[CREATE_ORDER] ✅ Order created: ${order._id}`);
  console.log(`[CREATE_ORDER] food_status   : ${order.food_status}`);
  console.log(`[CREATE_ORDER] total_amount  : ${order.total_amount} XAF`);
  console.log(`[CREATE_ORDER] Log in as Burger Lab → /vendor/kitchen to see it in the New column`);
}

run()
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
