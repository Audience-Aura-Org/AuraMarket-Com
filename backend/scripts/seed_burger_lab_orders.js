/**
 * scripts/seed_burger_lab_orders.js
 * Creates 10 persistent test orders for Burger Lab Yaoundé
 * across all food_status states with varied customers and quantities.
 *
 * Run  : node backend/scripts/seed_burger_lab_orders.js
 * Clean: node backend/scripts/seed_burger_lab_orders.js --clean
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

const NOTE_TAG = 'BurgerLab seed';

function imageUrl(product) {
  if (!Array.isArray(product.images) || !product.images.length) return null;
  const img = product.images[0];
  return typeof img === 'object' ? img?.url || null : img || null;
}

function makeOrder(customer, vendor, product, overrides = {}) {
  return {
    customer_id:         customer._id,
    vendor_id:           vendor._id,
    products: [{
      product_id:    product._id,
      name:          product.name,
      quantity:      overrides._qty || 1,
      price:         product.price,
      regular_price: product.regular_price || product.price,
      sale_price:    product.sale_price || null,
      image:         imageUrl(product),
      variant:       null,
    }],
    subtotal:        product.price * (overrides._qty || 1),
    shipping_fee:    0,
    total_amount:    product.price * (overrides._qty || 1),
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
      phone:   customer.phone || '+237600000001',
    },
    status_logs: [],
    ...overrides,
  };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('[BURGER_LAB] Connected to MongoDB');

  const vendor = await Vendor.findOne({ store_name: /burger lab/i }).lean();
  if (!vendor) throw new Error('Burger Lab vendor not found');

  const products = await Product.find({ vendor_id: vendor._id, price: { $gt: 0 } }).lean();
  if (!products.length) throw new Error('No products found for Burger Lab');

  const customers = await User.find({ role: 'customer', is_active: true }).limit(10).lean();
  if (!customers.length) throw new Error('No active customers found');

  console.log(`[BURGER_LAB] Vendor   : ${vendor.store_name} (${vendor._id})`);
  console.log(`[BURGER_LAB] Products : ${products.map(p => p.name).join(', ')}`);
  console.log(`[BURGER_LAB] Customers: ${customers.length} found\n`);

  const p = (i) => products[i % products.length];
  const c = (i) => customers[i % customers.length];
  const now = Date.now();

  const specs = [
    // 1 — New (just placed, awaiting acceptance)
    {
      _qty: 1, food_status: 'pending_acceptance', order_status: 'placed',
      acceptance_deadline: new Date(now + 14 * 60_000),
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 3 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 60_000) },
      ],
    },
    // 2 — New (just placed, different customer + 2 items)
    {
      _qty: 2, food_status: 'pending_acceptance', order_status: 'placed',
      acceptance_deadline: new Date(now + 12 * 60_000),
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 5 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 2 * 60_000) },
      ],
    },
    // 3 — Cooking (accepted, in kitchen)
    {
      _qty: 1, food_status: 'preparing', order_status: 'processing',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 22 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 20 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 18 * 60_000) },
      ],
    },
    // 4 — Cooking (3 items, been on for a while)
    {
      _qty: 3, food_status: 'preparing', order_status: 'processing',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 30 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 28 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 25 * 60_000) },
      ],
    },
    // 5 — Ready (vendor_managed — "Rider Picked Up" button visible)
    {
      _qty: 1, food_status: 'ready', order_status: 'processing', shipping_method: 'vendor_managed',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 45 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 43 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 40 * 60_000) },
        { status: 'ready',              note: NOTE_TAG, timestamp: new Date(now - 3 * 60_000) },
      ],
    },
    // 6 — Ready (logistics_partner — countdown shows, not yet 10 min)
    {
      _qty: 2, food_status: 'ready', order_status: 'processing', shipping_method: 'logistics_partner',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 50 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 48 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 45 * 60_000) },
        { status: 'ready',              note: NOTE_TAG, timestamp: new Date(now - 4 * 60_000) },
      ],
    },
    // 7 — In Transit (picked_up)
    {
      _qty: 1, food_status: 'picked_up', order_status: 'shipped',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 75 * 60_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 73 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 70 * 60_000) },
        { status: 'ready',              note: NOTE_TAG, timestamp: new Date(now - 55 * 60_000) },
        { status: 'picked_up',          note: NOTE_TAG, timestamp: new Date(now - 15 * 60_000) },
      ],
    },
    // 8 — Delivered (completed, paid)
    {
      _qty: 1, food_status: 'delivered', order_status: 'completed', payment_status: 'paid',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000 + 2 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000 + 7 * 60_000) },
        { status: 'ready',              note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000 + 25 * 60_000) },
        { status: 'picked_up',          note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000 + 38 * 60_000) },
        { status: 'delivered',          note: NOTE_TAG, timestamp: new Date(now - 3 * 3_600_000 + 55 * 60_000) },
      ],
    },
    // 9 — Delivered (completed, yesterday)
    {
      _qty: 2, food_status: 'delivered', order_status: 'completed', payment_status: 'paid',
      status_logs: [
        { status: 'placed',             note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000) },
        { status: 'pending_acceptance', note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000 + 3 * 60_000) },
        { status: 'preparing',          note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000 + 8 * 60_000) },
        { status: 'ready',              note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000 + 28 * 60_000) },
        { status: 'picked_up',          note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000 + 40 * 60_000) },
        { status: 'delivered',          note: NOTE_TAG, timestamp: new Date(now - 26 * 3_600_000 + 58 * 60_000) },
      ],
    },
    // 10 — Cancelled (customer changed mind)
    {
      _qty: 1, food_status: null, order_status: 'cancelled', payment_status: 'pending',
      status_logs: [
        { status: 'placed',    note: NOTE_TAG,          timestamp: new Date(now - 2 * 3_600_000) },
        { status: 'cancelled', note: 'Customer cancel', timestamp: new Date(now - 2 * 3_600_000 + 5 * 60_000) },
      ],
    },
  ];

  const created = [];
  for (let i = 0; i < specs.length; i++) {
    const { _qty, ...overrides } = specs[i];
    const order = await Order.create(makeOrder(c(i), vendor, p(i), { _qty, ...overrides }));
    const col = overrides.food_status || overrides.order_status;
    console.log(`[BURGER_LAB] ✅ Order ${i + 1} (${col}): ${order._id}  — ${c(i).email}`);
    created.push(order._id);
  }

  console.log(`\n[BURGER_LAB] ${created.length} orders created for Burger Lab Yaoundé`);
  console.log('[BURGER_LAB] Log in as Burger Lab to see them in /vendor/kitchen and /vendor/orders');
  console.log('[BURGER_LAB] To remove: node backend/scripts/seed_burger_lab_orders.js --clean');
}

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const vendor = await Vendor.findOne({ store_name: /burger lab/i }).lean();
  if (!vendor) { console.log('Burger Lab not found'); return; }
  const result = await Order.deleteMany({
    vendor_id: vendor._id,
    'status_logs.note': NOTE_TAG,
  });
  console.log(`[BURGER_LAB] Removed ${result.deletedCount} seed orders`);
}

const isClean = process.argv.includes('--clean');
(isClean ? clean() : run())
  .catch(err => { console.error('\n❌', err.message); process.exit(1); })
  .finally(() => mongoose.disconnect());
