/**
 * scripts/seed_kitchen_orders.js
 * Auradime — Kitchen kanban seed
 *
 * Creates one food order per kitchen column (pending_acceptance, preparing,
 * ready, picked_up) for EVERY restaurant vendor, plus a delivered order so
 * /vendor/orders shows a complete history.
 *
 * Customers rotate across all active customers so orders are spread.
 *
 * Run  : node backend/scripts/seed_kitchen_orders.js
 * Clean: node backend/scripts/seed_kitchen_orders.js --clean
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

const TAG = '[SEED_KITCHEN]';
const log = (msg) => console.log(`${TAG} ${msg}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function imageUrl(product) {
  if (!Array.isArray(product.images) || product.images.length === 0) return null;
  const img = product.images[0];
  return typeof img === 'object' ? img?.url || null : img || null;
}

function base(customer, vendor, product, overrides = {}) {
  return {
    customer_id:         customer._id,
    vendor_id:           vendor._id,
    products: [{
      product_id:    product._id,
      name:          product.name,
      quantity:      1,
      price:         product.price,
      regular_price: product.regular_price || product.price,
      sale_price:    product.sale_price || null,
      image:         imageUrl(product),
      variant:       null,
    }],
    subtotal:        product.price,
    shipping_fee:    0,
    total_amount:    product.price,
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
      street:  'Rue de la Joie 12',
      city:    'Yaoundé',
      region:  'Centre',
      country: 'Cameroon',
      phone:   customer.phone || '+237600000001',
    },
    status_logs: [],
    ...overrides,
  };
}

// ── Column definitions ────────────────────────────────────────────────────────

function makeColumns(customer, vendor, product) {
  const now = Date.now();
  return [
    // ── New (pending_acceptance) ──────────────────────────────────────────
    base(customer, vendor, product, {
      food_status:         'pending_acceptance',
      order_status:        'placed',
      acceptance_deadline: new Date(now + 14 * 60_000),
      status_logs: [
        { status: 'placed',             note: 'Kitchen seed', timestamp: new Date(now - 2 * 60_000) },
        { status: 'pending_acceptance', note: 'Awaiting restaurant', timestamp: new Date(now - 60_000) },
      ],
    }),

    // ── Cooking (preparing) ───────────────────────────────────────────────
    base(customer, vendor, product, {
      food_status:  'preparing',
      order_status: 'processing',
      status_logs: [
        { status: 'placed',             note: 'Kitchen seed', timestamp: new Date(now - 20 * 60_000) },
        { status: 'pending_acceptance', note: 'Awaiting restaurant', timestamp: new Date(now - 18 * 60_000) },
        { status: 'preparing',          note: 'Kitchen accepted', timestamp: new Date(now - 15 * 60_000) },
      ],
    }),

    // ── Ready (partner logistics — so logistics countdown shows) ──────────
    base(customer, vendor, product, {
      food_status:     'ready',
      order_status:    'processing',
      shipping_method: 'logistics_partner',
      status_logs: [
        { status: 'placed',             note: 'Kitchen seed', timestamp: new Date(now - 40 * 60_000) },
        { status: 'pending_acceptance', note: 'Awaiting restaurant', timestamp: new Date(now - 38 * 60_000) },
        { status: 'preparing',          note: 'Kitchen accepted', timestamp: new Date(now - 35 * 60_000) },
        // Ready just now → logistics override not yet triggered
        { status: 'ready',              note: 'Ready for pickup', timestamp: new Date(now - 2 * 60_000) },
      ],
    }),

    // ── In Transit (picked_up) ────────────────────────────────────────────
    base(customer, vendor, product, {
      food_status:  'picked_up',
      order_status: 'shipped',
      status_logs: [
        { status: 'placed',             note: 'Kitchen seed', timestamp: new Date(now - 60 * 60_000) },
        { status: 'pending_acceptance', note: 'Awaiting restaurant', timestamp: new Date(now - 58 * 60_000) },
        { status: 'preparing',          note: 'Kitchen accepted', timestamp: new Date(now - 55 * 60_000) },
        { status: 'ready',              note: 'Ready for pickup',  timestamp: new Date(now - 45 * 60_000) },
        { status: 'picked_up',          note: 'Rider dispatched',  timestamp: new Date(now - 10 * 60_000) },
      ],
    }),

    // ── Completed (delivered) — shows in /vendor/orders ──────────────────
    base(customer, vendor, product, {
      food_status:    'delivered',
      order_status:   'completed',
      payment_status: 'paid',
      status_logs: [
        { status: 'placed',             note: 'Kitchen seed', timestamp: new Date(now - 3 * 3_600_000) },
        { status: 'pending_acceptance', note: 'Awaiting restaurant', timestamp: new Date(now - 3 * 3_600_000 + 60_000) },
        { status: 'preparing',          note: 'Kitchen accepted', timestamp: new Date(now - 3 * 3_600_000 + 5 * 60_000) },
        { status: 'ready',              note: 'Ready for pickup',  timestamp: new Date(now - 3 * 3_600_000 + 25 * 60_000) },
        { status: 'picked_up',          note: 'Rider dispatched',  timestamp: new Date(now - 3 * 3_600_000 + 40 * 60_000) },
        { status: 'delivered',          note: 'Delivered',         timestamp: new Date(now - 3 * 3_600_000 + 55 * 60_000) },
      ],
    }),
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  log('Connected to MongoDB');

  const customers = await User.find({ role: 'customer', is_active: true }).lean();
  if (!customers.length) throw new Error('No active customers found');

  const restaurants = await Vendor.find({ vendor_type: 'restaurant' }).lean();
  if (!restaurants.length) throw new Error('No restaurant vendors found');

  log(`Customers  : ${customers.length}`);
  log(`Restaurants: ${restaurants.map(r => r.store_name).join(', ')}`);
  console.log();

  const created = [];
  let customerIdx = 0;

  for (const vendor of restaurants) {
    const product = await Product.findOne({ vendor_id: vendor._id, price: { $gt: 0 } }).lean();
    if (!product) {
      log(`  ⚠️  No product for ${vendor.store_name} — skipping`);
      continue;
    }

    const customer = customers[customerIdx % customers.length];
    customerIdx++;

    const columns = makeColumns(customer, vendor, product);
    const orders  = await Order.insertMany(columns);

    orders.forEach((o, i) => {
      const col = ['pending_acceptance', 'preparing', 'ready', 'picked_up', 'delivered'][i];
      log(`✅ ${vendor.store_name} / ${col}: ${o._id}`);
    });
    created.push(...orders.map(o => o._id));
    console.log();
  }

  log(`${created.length} orders created across ${restaurants.length} restaurant(s)`);
  log('Log in as each restaurant vendor to see their kanban');
  log('To remove: node backend/scripts/seed_kitchen_orders.js --clean');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  log('Cleaning kitchen seed orders...');
  const result = await Order.deleteMany({
    'status_logs.note': { $regex: /^Kitchen seed/i },
  });
  log(`Removed ${result.deletedCount} kitchen seed orders`);
}

const isClean = process.argv.includes('--clean');
(isClean ? clean() : run())
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
