/**
 * scripts/seed_test_orders.js
 * Auradime — Persistent test order seeder
 *
 * Creates real orders (food + retail) in multiple states for the first
 * active customer so they are visible in the UI Orders tab.
 *
 * Does NOT clean up — run clean_test_orders.js to remove them.
 *
 * Run: node backend/scripts/seed_test_orders.js
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const TAG = '[SEED_TEST_ORDER]';

function log(msg) { console.log(`${TAG} ${msg}`); }

function orderBase(customer, vendor, product, overrides = {}) {
  return {
    customer_id:      customer._id,
    vendor_id:        vendor._id,
    products: [{
      product_id: product._id,
      name:       product.name,
      quantity:   1,
      price:      product.price,
      regular_price: product.regular_price || product.price,
      sale_price: product.sale_price || null,
      image:      Array.isArray(product.images)
        ? (typeof product.images[0] === 'object' ? product.images[0]?.url : product.images[0]) || null
        : (product.images || null),
      variant:    null,
    }],
    subtotal:       product.price,
    shipping_fee:   0,
    total_amount:   product.price,
    payment_method: 'pay_on_delivery',
    payment_status: 'pending',
    shipping_method: 'vendor_managed',
    shipping_address: {
      street:  'Rue de la Joie 12',
      city:    'Yaoundé',
      region:  'Centre',
      country: 'Cameroon',
      phone:   customer.phone || '+237600000001',
    },
    escrow_enabled: false,
    status_logs: [],
    ...overrides,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  log('Connected to MongoDB');

  // ── Fixtures ──────────────────────────────────────────────────────────────
  const customer = await User.findOne({ role: 'customer', is_active: true }).lean();
  if (!customer) throw new Error('No active customer found');

  const retailVendor = await Vendor.findOne({
    vendor_type: { $in: ['retail', 'digital'] },
  }).lean();
  if (!retailVendor) throw new Error('No retail vendor found');

  const retailProduct = await Product.findOne({
    vendor_id: retailVendor._id,
    price: { $gt: 0 },
  }).lean();
  if (!retailProduct) throw new Error('No retail product found');

  const foodVendors = await Vendor.find({ vendor_type: 'restaurant' }).lean();

  log(`Customer  : ${customer.email}`);
  log(`Retail    : ${retailVendor.store_name} / ${retailProduct.name} (${retailProduct.price} XAF)`);
  log(`Restaurants: ${foodVendors.map(v => v.store_name).join(', ') || 'none'}`);
  console.log();

  const created = [];

  // ── Order 1: Retail — PLACED (just arrived, pending) ─────────────────────
  const o1 = await Order.create(orderBase(customer, retailVendor, retailProduct, {
    payment_status: 'pending',
    order_status:   'placed',
    status_logs: [{ status: 'placed', note: 'Test order — placed', timestamp: new Date() }],
  }));
  log(`✅ Order 1 created (retail / placed):       ${o1._id}`);
  created.push(o1._id);

  // ── Order 2: Retail — PROCESSING (vendor accepted) ───────────────────────
  const o2 = await Order.create(orderBase(customer, retailVendor, retailProduct, {
    payment_status: 'pending',
    order_status:   'processing',
    status_logs: [
      { status: 'placed',     note: 'Test order — placed',            timestamp: new Date(Date.now() - 3600_000) },
      { status: 'processing', note: 'Test order — vendor processing', timestamp: new Date() },
    ],
  }));
  log(`✅ Order 2 created (retail / processing):   ${o2._id}`);
  created.push(o2._id);

  // ── Order 3: Retail — SHIPPED (in transit) ───────────────────────────────
  const o3 = await Order.create(orderBase(customer, retailVendor, retailProduct, {
    payment_status: 'pending',
    order_status:   'shipped',
    status_logs: [
      { status: 'placed',     note: 'Test order', timestamp: new Date(Date.now() - 7_200_000) },
      { status: 'processing', note: 'Vendor confirmed',   timestamp: new Date(Date.now() - 3_600_000) },
      { status: 'shipped',    note: 'Dispatched to rider', timestamp: new Date() },
    ],
  }));
  log(`✅ Order 3 created (retail / shipped):      ${o3._id}`);
  created.push(o3._id);

  // ── Order 4: Retail — COMPLETED (paid, delivered) ────────────────────────
  const o4 = await Order.create(orderBase(customer, retailVendor, retailProduct, {
    payment_status: 'paid',
    order_status:   'completed',
    payment_method: 'pay_on_delivery',
    status_logs: [
      { status: 'placed',     note: 'Test order', timestamp: new Date(Date.now() - 86_400_000) },
      { status: 'processing', note: 'Vendor confirmed',   timestamp: new Date(Date.now() - 82_800_000) },
      { status: 'shipped',    note: 'Out for delivery',   timestamp: new Date(Date.now() - 79_200_000) },
      { status: 'completed',  note: 'Delivered, cash collected', timestamp: new Date(Date.now() - 3_600_000) },
    ],
  }));
  log(`✅ Order 4 created (retail / completed):    ${o4._id}`);
  created.push(o4._id);

  // ── Order 5: Retail — CANCELLED ──────────────────────────────────────────
  const o5 = await Order.create(orderBase(customer, retailVendor, retailProduct, {
    payment_status: 'pending',
    order_status:   'cancelled',
    status_logs: [
      { status: 'placed',    note: 'Test order',     timestamp: new Date(Date.now() - 172_800_000) },
      { status: 'cancelled', note: 'Customer cancelled', timestamp: new Date(Date.now() - 169_200_000) },
    ],
  }));
  log(`✅ Order 5 created (retail / cancelled):    ${o5._id}`);
  created.push(o5._id);

  // ── Food orders: one pending_acceptance + one delivered per restaurant vendor ──
  for (const fv of foodVendors) {
    const fp = await Product.findOne({ vendor_id: fv._id, price: { $gt: 0 } }).lean();
    if (!fp) { log(`  ⚠️  No product found for ${fv.store_name} — skipping food orders`); continue; }

    const oNew = await Order.create(orderBase(customer, fv, fp, {
      payment_status:      'pending',
      order_status:        'placed',
      food_status:         'pending_acceptance',
      fulfilment_type:     'delivery',
      escrow_enabled:      false,
      new_restaurant_hold: false,
      acceptance_deadline: new Date(Date.now() + 15 * 60_000),
      status_logs: [{ status: 'pending_acceptance', note: 'Food test order', timestamp: new Date() }],
    }));
    log(`✅ Food order created (${fv.store_name} / pending_acceptance): ${oNew._id}`);
    created.push(oNew._id);

    const oDone = await Order.create(orderBase(customer, fv, fp, {
      payment_status:  'paid',
      order_status:    'completed',
      food_status:     'delivered',
      fulfilment_type: 'delivery',
      escrow_enabled:  false,
      payment_method:  'pay_on_delivery',
      status_logs: [
        { status: 'pending_acceptance', note: 'Food test', timestamp: new Date(Date.now() - 7_200_000) },
        { status: 'preparing',          note: 'Kitchen accepted', timestamp: new Date(Date.now() - 6_600_000) },
        { status: 'ready',              note: 'Ready for pickup',  timestamp: new Date(Date.now() - 5_400_000) },
        { status: 'picked_up',          note: 'Rider collected',   timestamp: new Date(Date.now() - 3_600_000) },
        { status: 'delivered',          note: 'Delivered',         timestamp: new Date(Date.now() - 1_800_000) },
      ],
    }));
    log(`✅ Food order created (${fv.store_name} / delivered):          ${oDone._id}`);
    created.push(oDone._id);
  }

  console.log();
  log(`${created.length} test orders created for customer: ${customer.email}`);
  log('Log in as that account to see them in /profile?tab=orders');
  log('To remove them: node backend/scripts/seed_test_orders.js --clean');
  log(`IDs: ${created.map(id => id.toString()).join(', ')}`);
}

// ── Optional cleanup mode ─────────────────────────────────────────────────
async function clean() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  log('Connected to MongoDB — cleaning test orders...');
  const result = await Order.deleteMany({
    'status_logs.note': { $regex: /^Test order|^Food test/i },
  });
  log(`Removed ${result.deletedCount} test orders`);
}

const isClean = process.argv.includes('--clean');
(isClean ? clean() : run())
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
