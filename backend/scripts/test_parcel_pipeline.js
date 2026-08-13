/**
 * scripts/test_parcel_pipeline.js
 * Auradime — Retail parcel → logistics delivery pipeline test
 *
 * Tests the complete flow for a normal retail order fulfilled via logistics:
 *   Order placed (COD + logistics_partner)
 *   → Shipment created
 *   → assigned → picked_up → in_transit → out_for_delivery → delivered
 *   → Logistics fee credited
 *   → Vendor wallet credited (COD path)
 *   → Order completed
 *
 * Run: node backend/scripts/test_parcel_pipeline.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

require('../models/Category.model');
require('../models/UserSubscription.model');
require('../models/Escrow.model');
require('../models/LogisticZone.model');

const Order            = require('../models/Order.model');
const Shipment         = require('../models/Shipment.model');
const Product          = require('../models/Product.model');
const Vendor           = require('../models/Vendor.model');
const User             = require('../models/User.model');
const Transaction      = require('../models/Transaction.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { createShipmentsForOrder } = require('../services/logistics.service');
const { calculatePlatformFees }   = require('../utils/platformFees');
const { applyCommissionOverride } = require('../utils/platformFees');
const Store            = require('../models/Store.model');

// ── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0; let failed = 0;
const checks = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const symbol = ok ? '✅' : '❌';
  console.log(`  ${symbol} ${label}: ${JSON.stringify(actual)}` + (!ok ? ` (expected: ${JSON.stringify(expected)})` : ''));
  checks.push({ label, ok, actual, expected });
  ok ? passed++ : failed++;
}

const generateTxRef = () =>
  `AURA-COD-${Math.floor(100000 + Math.random() * 900000)}`;

// ── Shipment status mover (replicates modifyShipmentStatus core logic) ───────
async function advanceShipment(shipmentId, status, note, extraFields = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const shipment = await Shipment.findById(shipmentId).session(session);
    const order    = await Order.findById(shipment.order_id).session(session);
    const firm     = await LogisticsCompany.findById(shipment.logistics_id).session(session);

    if (order.shipping_method !== 'logistics_partner') {
      throw new Error('Not a logistics_partner order');
    }

    // Apply proof/extra fields for delivery
    if (status === 'delivered') {
      if (!extraFields.note && !extraFields.proof_image) {
        throw new Error('Proof of delivery required for delivered status');
      }
      shipment.proof_of_delivery = {
        image_url:     extraFields.proof_image || null,
        note:          extraFields.note || note,
        receiver_name: extraFields.receiver_name || 'Customer',
        timestamp:     new Date(),
      };
    }

    shipment.status = status;
    shipment.shipment_logs.push({ status, timestamp: new Date(), note: note || '' });
    await shipment.save({ session });

    // Sync order_status
    if (status === 'delivered') {
      const others = await Shipment.find({
        order_id: order._id,
        _id: { $ne: shipment._id },
      }).session(session);

      const allDelivered = others.every(s => s.status === 'delivered');
      if (allDelivered) {
        order.order_status = 'delivered';

        // COD path: credit logistics fee, then credit vendor immediately
        if (order.shipping_fee > 0) {
          const logisticsUser = await User.findById(firm.user_id).session(session);
          if (logisticsUser) {
            logisticsUser.wallet_balance += order.shipping_fee;
            await logisticsUser.save({ session });
            await Transaction.create([{
              user_id:     logisticsUser._id,
              type:        'payout',
              amount:      order.shipping_fee,
              reference:   `LOG-${generateTxRef()}`,
              status:      'completed',
              description: `Delivery payout for Order #${order._id.toString().slice(-6).toUpperCase()}`,
              order_id:    order._id,
              gateway:     'wallet',
            }], { session, ordered: true });
          }
        }

        if (order.payment_method === 'pay_on_delivery') {
          const vendorAccount = await Vendor.findById(order.vendor_id).session(session);
          if (vendorAccount) {
            const vendorUser = await User.findById(vendorAccount.user_id).session(session);
            if (vendorUser) {
              const vendorBaseAmount = order.subtotal; // logistics_partner → exclude shipping
              vendorUser.wallet_balance += vendorBaseAmount;
              await vendorUser.save({ session });

              await Transaction.create([{
                user_id:     vendorUser._id,
                type:        'payout',
                amount:      vendorBaseAmount,
                reference:   generateTxRef(),
                status:      'completed',
                description: `COD payment settled via logistics (Order #${order._id.toString().slice(-6).toUpperCase()})`,
                order_id:    order._id,
              }], { session, ordered: true });

              order.payment_status = 'paid';
              order.order_status   = 'completed';
            }
          }
        }

        await order.save({ session });
      }
    } else if (['picked_up', 'assigned', 'in_transit', 'out_for_delivery'].includes(status)) {
      order.order_status = 'shipped';
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    return { shipment: await Shipment.findById(shipmentId).lean(), order: await Order.findById(order._id).lean() };
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');
  console.log('='.repeat(60));
  console.log('RETAIL PARCEL → LOGISTICS DELIVERY PIPELINE TEST');
  console.log('='.repeat(60));
  console.log();

  // ── Fixtures ───────────────────────────────────────────────────────────────
  const retailVendor = await Vendor.findOne({ vendor_type: 'retail', is_onboarded: true }).lean();
  if (!retailVendor) throw new Error('No onboarded retail vendor found');

  const product = await Product.findOne({ vendor_id: retailVendor._id, status: 'active', meal: null }).lean();
  if (!product) throw new Error('No active retail product found for vendor');

  const firm = await LogisticsCompany.findOne({ is_verified: true }).lean();
  if (!firm) throw new Error('No verified logistics company found');

  const customer = await User.findOne({ role: 'customer', is_active: true }).lean();
  if (!customer) throw new Error('No customer found');

  const vendorUser     = await User.findById(retailVendor.user_id).lean();
  const logisticsUser  = await User.findById(firm.user_id).lean();
  const deliveryQtier  = firm.quartier_prices?.[0]?.quartier || 'Biyem-Assi';
  const shippingFee    = firm.quartier_prices?.[0]?.price    || 1000;
  const ps             = await PlatformSettings.getSettings();

  console.log(`Vendor    : ${retailVendor.store_name} (${retailVendor._id})`);
  console.log(`Product   : ${product.name} — ${product.price.toLocaleString()} XAF`);
  console.log(`Logistics : ${firm.company_name} (${firm._id})`);
  console.log(`Delivery  : ${deliveryQtier} — ${shippingFee.toLocaleString()} XAF shipping`);
  console.log(`Customer  : ${customer.email}`);
  console.log(`Commission: ${ps.commission_rate}%`);
  console.log();

  const logisticsBefore = logisticsUser.wallet_balance;
  const vendorBefore    = vendorUser.wallet_balance;
  console.log(`Logistics wallet before: ${logisticsBefore.toLocaleString()} XAF`);
  console.log(`Vendor wallet before:    ${vendorBefore.toLocaleString()} XAF`);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 0 — Place the retail order (COD + logistics_partner)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 0: Place retail order (pay_on_delivery, logistics_partner)');
  const subtotal    = product.price * 1;
  const totalAmount = subtotal + shippingFee;

  const order = await Order.create({
    customer_id:      customer._id,
    vendor_id:        retailVendor._id,
    products: [{
      product_id:    product._id,
      name:          product.name,
      price:         product.price,
      regular_price: product.price,
      quantity:      1,
      image:         product.images?.[0]?.url || '',
    }],
    subtotal,
    shipping_fee:      shippingFee,
    platform_fee:      0,
    total_amount:      totalAmount,
    payment_method:    'pay_on_delivery',
    payment_status:    'pending',
    order_status:      'placed',
    shipping_method:   'logistics_partner',
    logistics_company_id: firm._id,
    escrow_enabled:    false,
    shipping_address: {
      city:    'Yaoundé',
      region:  'Centre',
      quartier: deliveryQtier,
      country: 'Cameroon',
    },
    delivery_description: 'Test parcel delivery',
  });
  check('order_status at placement', order.order_status, 'placed');
  check('payment_status at placement', order.payment_status, 'pending');
  check('shipping_method', order.shipping_method, 'logistics_partner');
  check('shipping_fee', order.shipping_fee, shippingFee);
  check('subtotal', order.subtotal, subtotal);
  check('total_amount', order.total_amount, totalAmount);
  check('food_status is null (retail)', order.food_status, null);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Create Shipment (simulating createShipmentsForOrder)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 1: Create Shipment (logistics assignment)');
  const trackingCode = `AURA-${Math.floor(100000 + Math.random() * 900000)}`;
  const shipment = await Shipment.create({
    order_id:     order._id,
    vendor_id:    retailVendor._id,
    logistics_id: firm._id,
    tracking_code: trackingCode,
    status:       'pending',
    price:        shippingFee,
    pickup_address: {
      ...retailVendor.pickup_address,
      phone: retailVendor.phone,
    },
    delivery_address: {
      city:     'Yaoundé',
      quartier: deliveryQtier,
    },
    delivery_description: 'Test parcel delivery',
    shipment_logs: [{
      status:    'pending',
      timestamp: new Date(),
      note:      'Shipment initialized — COD order placed.',
    }],
  });
  check('shipment created', !!shipment._id, true);
  check('shipment status', shipment.status, 'pending');
  check('shipment price', shipment.price, shippingFee);
  check('tracking_code format', shipment.tracking_code.startsWith('AURA-'), true);
  console.log(`  Tracking code: ${shipment.tracking_code}`);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Logistics assigns rider (pending → assigned)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 2: Logistics assigns rider (pending → assigned)');
  let result = await advanceShipment(shipment._id, 'assigned', 'Rider assigned by dispatcher');
  check('shipment status', result.shipment.status, 'assigned');
  check('order_status synced to shipped', result.order.order_status, 'shipped');
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Rider picks up parcel (assigned → picked_up)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 3: Rider collects parcel from vendor (assigned → picked_up)');
  result = await advanceShipment(shipment._id, 'picked_up', 'Parcel collected from vendor warehouse');
  check('shipment status', result.shipment.status, 'picked_up');
  check('order_status still shipped', result.order.order_status, 'shipped');
  check('shipment_logs count', result.shipment.shipment_logs.length, 3); // pending + assigned + picked_up
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — In transit (picked_up → in_transit)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 4: Parcel in transit (picked_up → in_transit)');
  result = await advanceShipment(shipment._id, 'in_transit', 'Moving towards delivery zone');
  check('shipment status', result.shipment.status, 'in_transit');
  check('order_status still shipped', result.order.order_status, 'shipped');
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Out for delivery (in_transit → out_for_delivery)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 5: Last mile — out for delivery (in_transit → out_for_delivery)');
  result = await advanceShipment(shipment._id, 'out_for_delivery', 'Rider at customer neighbourhood');
  check('shipment status', result.shipment.status, 'out_for_delivery');
  check('order_status still shipped', result.order.order_status, 'shipped');
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6 — Delivered (out_for_delivery → delivered)
  //          → logistics fee credited
  //          → vendor payout (COD subtotal) credited immediately
  //          → order_status: completed, payment_status: paid
  // ══════════════════════════════════════════════════════════════════════════
  console.log('STEP 6: Delivered to customer (→ delivered) — COD collection + settlement');
  result = await advanceShipment(
    shipment._id,
    'delivered',
    'Customer received parcel, cash collected',
    { proof_image: null, note: 'Delivered — Customer signed receipt', receiver_name: 'Brandon' }
  );
  check('shipment status', result.shipment.status, 'delivered');
  check('order_status', result.order.order_status, 'completed');
  check('payment_status', result.order.payment_status, 'paid');
  check('proof_of_delivery set', !!result.shipment.proof_of_delivery?.note, true);
  check('proof receiver_name', result.shipment.proof_of_delivery?.receiver_name, 'Brandon');
  console.log();

  // ── Verify wallet credits ──────────────────────────────────────────────────
  console.log('WALLET VERIFICATION:');
  const logisticsAfter = (await User.findById(firm.user_id).lean()).wallet_balance;
  const vendorAfter    = (await User.findById(retailVendor.user_id).lean()).wallet_balance;

  const logisticsCredited = logisticsAfter - logisticsBefore;
  const vendorCredited    = vendorAfter - vendorBefore;

  console.log(`  Logistics: ${logisticsBefore.toLocaleString()} → ${logisticsAfter.toLocaleString()} XAF (+${logisticsCredited.toLocaleString()})`);
  console.log(`  Vendor:    ${vendorBefore.toLocaleString()} → ${vendorAfter.toLocaleString()} XAF (+${vendorCredited.toLocaleString()})`);

  check('logistics credited shipping_fee', logisticsCredited, shippingFee);
  check('vendor credited subtotal (COD, 0% commission)', vendorCredited, subtotal);
  console.log();

  // ── Verify Transaction records ─────────────────────────────────────────────
  console.log('TRANSACTION AUDIT:');
  const txns = await Transaction.find({ order_id: order._id }).lean();
  txns.forEach(t => console.log(`  [${t.type.toUpperCase()}] ${t.amount.toLocaleString()} XAF — ${t.description.slice(0, 60)}`));
  check('transaction count (logistics + vendor)', txns.length, 2);
  const logTxn = txns.find(t => t.description?.includes('Delivery payout'));
  const venTxn = txns.find(t => t.description?.includes('COD payment settled'));
  check('logistics payout tx exists', !!logTxn, true);
  check('vendor payout tx exists', !!venTxn, true);
  check('logistics tx amount', logTxn?.amount, shippingFee);
  check('vendor tx amount', venTxn?.amount, subtotal);
  console.log();

  // ── Verify full shipment log trail ─────────────────────────────────────────
  const finalShipment = await Shipment.findById(shipment._id).lean();
  console.log('SHIPMENT LOG TRAIL:');
  finalShipment.shipment_logs.forEach((l, i) =>
    console.log(`  [${i + 1}] ${l.status.padEnd(20)} ${l.note}`)
  );
  check('shipment_logs count', finalShipment.shipment_logs.length, 6);
  // pending, assigned, picked_up, in_transit, out_for_delivery, delivered
  const expectedLog = ['pending','assigned','picked_up','in_transit','out_for_delivery','delivered'];
  check('shipment log sequence', finalShipment.shipment_logs.map(l => l.status), expectedLog);
  console.log();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await Shipment.deleteOne({ _id: shipment._id });
  await Transaction.deleteMany({ order_id: order._id });
  await Order.deleteOne({ _id: order._id });
  // Restore wallet balances
  await User.findByIdAndUpdate(firm.user_id,    { wallet_balance: logisticsBefore });
  await User.findByIdAndUpdate(retailVendor.user_id, { wallet_balance: vendorBefore });
  console.log('Test data + wallet balances restored.');
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ ALL RETAIL PARCEL PIPELINE CHECKS PASSED');
  } else {
    console.log('❌ ' + failed + ' CHECK(S) FAILED:');
    checks.filter(c => !c.ok).forEach(c =>
      console.log(`  FAIL: ${c.label}: got ${JSON.stringify(c.actual)}, expected ${JSON.stringify(c.expected)}`)
    );
  }
  console.log('='.repeat(60));
}

run()
  .catch(err => {
    console.error('\n❌ Test crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
