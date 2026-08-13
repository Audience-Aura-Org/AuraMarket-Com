/**
 * scripts/test_food_pipeline.js
 * Auradime — Full food-order pipeline test
 *
 * Tests every status transition from placement through logistics delivery,
 * including the payout flow. Cleans up after itself.
 *
 * Run: node backend/scripts/test_food_pipeline.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Register all models (required for cross-model populate / validation)
require('../models/Category.model');
require('../models/UserSubscription.model');
require('../models/Store.model');
require('../models/Shipment.model');
require('../models/Escrow.model');
require('../models/LogisticZone.model');

const Order           = require('../models/Order.model');
const Transaction     = require('../models/Transaction.model');
const Product         = require('../models/Product.model');
const Vendor          = require('../models/Vendor.model');
const User            = require('../models/User.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { handleVendorPayout, creditLogistics, releaseRestaurantHold } = require('../services/payment/settle.service');

// ── Assertion helper ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const symbol = ok ? '✅' : '❌';
  const msg = `  ${symbol} ${label}: ${JSON.stringify(actual)}` + (!ok ? ` (expected: ${JSON.stringify(expected)})` : '');
  console.log(msg);
  results.push({ label, ok, actual, expected });
  ok ? passed++ : failed++;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');
  console.log('='.repeat(50));
  console.log('FULL FOOD ORDER PIPELINE TEST');
  console.log('='.repeat(50));
  console.log();

  // ── Setup: find test fixtures ───────────────────────────────────────────────
  const vendor = await Vendor.findOne({ store_name: 'Burger Lab', vendor_type: 'restaurant' }).lean();
  if (!vendor) throw new Error('Burger Lab not found — run migration 14 first');

  const meal = await Product.findOne({ vendor_id: vendor._id, 'meal.booking_options': { $exists: true }, status: 'active' }).lean();
  if (!meal) throw new Error('No meal product found for Burger Lab');

  const customer = await User.findOne({ role: 'customer', is_active: true }).lean();
  if (!customer) throw new Error('No customer found');

  const vendorUser = await User.findById(vendor.user_id).lean();
  const ps = await PlatformSettings.getSettings();

  console.log(`Vendor    : ${vendor.store_name} (${vendor._id})`);
  console.log(`Meal      : ${meal.name} — ${meal.price.toLocaleString()} XAF`);
  console.log(`Customer  : ${customer.email}`);
  console.log(`Commission: ${ps.commission_rate}%`);
  console.log(`Hold threshold: ${ps.new_restaurant_hold_order_count} orders`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 0 — Place the food order
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 0: Place food order (pay_on_delivery, vendor_managed shipping)');

  const deliveredCount = await Order.countDocuments({ vendor_id: vendor._id, food_status: 'delivered' });
  const expectHold = deliveredCount < ps.new_restaurant_hold_order_count || vendor.cancel_rate_hold;
  console.log(`  Completed deliveries: ${deliveredCount} → new_restaurant_hold should be: ${expectHold}`);

  const order = await Order.create({
    customer_id:      customer._id,
    vendor_id:        vendor._id,
    products: [{
      product_id:       meal._id,
      name:             meal.name,
      price:            meal.price,
      regular_price:    meal.price,
      quantity:         2,
      image:            '',
      selected_options: [{ group_name: 'Bun type', option_label: 'Brioche bun', price_delta: 0 }],
    }],
    subtotal:          meal.price * 2,
    shipping_fee:      0,
    platform_fee:      0,
    total_amount:      meal.price * 2,
    payment_method:    'pay_on_delivery',
    payment_status:    'pending',
    order_status:      'placed',
    shipping_method:   'vendor_managed',
    escrow_enabled:    false,
    fulfilment_type:   'delivery',
    food_status:       'pending_acceptance',
    acceptance_deadline: new Date(Date.now() + 10 * 60 * 1000),
    new_restaurant_hold: expectHold,
    dispute_window_closes_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status_logs: [{ status: 'pending_acceptance', note: 'Pipeline test', timestamp: new Date() }],
  });

  check('food_status at placement', order.food_status, 'pending_acceptance');
  check('order_status at placement', order.order_status, 'placed');
  check('escrow_enabled', order.escrow_enabled, false);
  check('new_restaurant_hold', order.new_restaurant_hold, expectHold);
  check('fulfilment_type', order.fulfilment_type, 'delivery');
  check('acceptance_deadline is set', order.acceptance_deadline !== null, true);
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Restaurant accepts: pending_acceptance → preparing
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 1: Restaurant accepts (pending_acceptance → preparing)');
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      if (o.food_status !== 'pending_acceptance') throw new Error(`Wrong source state: ${o.food_status}`);
      o.order_status = 'processing';
      o.food_status  = 'preparing';
      o.status_logs.push({ status: 'preparing', note: 'Kitchen accepted', timestamp: new Date() });
      await o.save({ session });
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 1 FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    const fresh = await Order.findById(order._id).lean();
    check('food_status after accept', fresh.food_status, 'preparing');
    check('order_status after accept', fresh.order_status, 'processing');
    check('status_logs count', fresh.status_logs.length, 2);
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Kitchen ready: preparing → ready
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 2: Kitchen ready (preparing → ready)');
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      if (o.food_status !== 'preparing') throw new Error(`Wrong source state: ${o.food_status}`);
      o.food_status = 'ready';
      o.status_logs.push({ status: 'ready', note: 'Food ready for pickup', timestamp: new Date() });
      await o.save({ session });
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 2 FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    const fresh = await Order.findById(order._id).lean();
    check('food_status after ready', fresh.food_status, 'ready');
    check('order_status unchanged', fresh.order_status, 'processing');
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 3 — Rider arrives: ready → rider_arrived
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 3: Rider arrives at restaurant (ready → rider_arrived)');
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      if (o.food_status !== 'ready') throw new Error(`Wrong source state: ${o.food_status}`);
      o.food_status     = 'rider_arrived';
      o.rider_arrived_at = new Date();
      o.status_logs.push({ status: 'rider_arrived', note: 'Rider scanned QR at restaurant', timestamp: new Date() });
      await o.save({ session });  // ← was failing before fix (enum missing rider_arrived)
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 3 FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    const fresh = await Order.findById(order._id).lean();
    check('food_status after rider_arrived', fresh.food_status, 'rider_arrived');
    check('rider_arrived_at is set', fresh.rider_arrived_at !== null, true);
    check('order_status still processing', fresh.order_status, 'processing');
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 4 — Rider picks up: rider_arrived → picked_up
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 4: Rider picks up food (rider_arrived → picked_up)');
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      if (!['ready', 'rider_arrived'].includes(o.food_status)) throw new Error(`Wrong source state: ${o.food_status}`);
      o.order_status = 'shipped';
      o.food_status  = 'picked_up';
      o.status_logs.push({ status: 'picked_up', note: 'Rider picked up food', timestamp: new Date() });
      // creditLogistics is a no-op here (vendor_managed, no logistics_company_id)
      await creditLogistics(o, session);
      await o.save({ session });
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 4 FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    const fresh = await Order.findById(order._id).lean();
    check('food_status after pickup', fresh.food_status, 'picked_up');
    check('order_status after pickup', fresh.order_status, 'shipped');
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 5 — Simulate COD payment received at door
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 5a: Simulate COD payment received at door (pay_on_delivery)');
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      o.payment_status = 'paid';
      await o.save({ session });
      // handleVendorPayout → for new_restaurant_hold=true, creates pending PAYOUT-HELD tx
      await handleVendorPayout(o, session);
      await session.commitTransaction();
      console.log('  ✔ Payment status set to paid, PAYOUT-HELD transaction created');
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 5a FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    // Verify the hold transaction was created
    const holdTx = await Transaction.findOne({ order_id: order._id, status: 'pending' }).lean();
    check('PAYOUT-HELD tx exists', !!holdTx, true);
    check('PAYOUT-HELD tx amount', holdTx?.amount, order.subtotal);  // 0% commission → full subtotal
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 5b — Delivered: picked_up → delivered + releaseRestaurantHold
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STEP 5b: Food delivered (picked_up → delivered) + release vendor hold');
  const vendorWalletBefore = (await User.findById(vendor.user_id).lean()).wallet_balance;
  console.log(`  Vendor wallet before delivery: ${vendorWalletBefore.toLocaleString()} XAF`);
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const o = await Order.findById(order._id).session(session);
      if (o.food_status !== 'picked_up') throw new Error(`Wrong source state: ${o.food_status}`);
      o.order_status = 'completed';
      o.food_status  = 'delivered';
      o.status_logs.push({ status: 'delivered', note: 'Delivered successfully', timestamp: new Date() });
      await releaseRestaurantHold(o, session);
      await o.save({ session });
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      console.log(`  ❌ STEP 5b FAILED: ${e.message}`);
      failed++;
    } finally {
      session.endSession();
    }
    const fresh = await Order.findById(order._id).lean();
    check('food_status after delivery', fresh.food_status, 'delivered');
    check('order_status after delivery', fresh.order_status, 'completed');

    const vendorWalletAfter = (await User.findById(vendor.user_id).lean()).wallet_balance;
    const credited = vendorWalletAfter - vendorWalletBefore;
    console.log(`  Vendor wallet after delivery : ${vendorWalletAfter.toLocaleString()} XAF (credited: +${credited.toLocaleString()} XAF)`);
    // With 0% commission the vendor gets the full subtotal
    const expectedCredit = order.subtotal; // 3500 * 2 = 7000
    check('vendor wallet credited on delivery', credited, expectedCredit);

    // Hold tx should now be completed
    const holdTx = await Transaction.findOne({ order_id: order._id, reference: /^PAYOUT-HELD/ }).lean();
    check('PAYOUT-HELD tx status after delivery', holdTx?.status, 'completed');

    check('total status_logs count', fresh.status_logs.length, 6);
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // Verify full status_logs trail
  // ════════════════════════════════════════════════════════════════════════════
  console.log('STATUS LOG TRAIL:');
  const finalOrder = await Order.findById(order._id).lean();
  finalOrder.status_logs.forEach((log, i) => {
    console.log(`  [${i + 1}] ${log.status.padEnd(20)} ${log.note || ''}`);
  });
  console.log();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await Order.deleteOne({ _id: order._id });
  await Transaction.deleteMany({ order_id: order._id });
  console.log('Test data cleaned up.');
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ ALL PIPELINE CHECKS PASSED');
  } else {
    console.log('❌ ' + failed + ' CHECK(S) FAILED');
    results.filter(r => !r.ok).forEach(r => console.log(`  FAIL: ${r.label}: ${r.actual} ≠ ${r.expected}`));
  }
  console.log('='.repeat(50));
}

run()
  .catch(err => {
    console.error('\n❌ Test crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
