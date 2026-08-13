/**
 * services/orphanDetector.service.js
 * Auradime — Phase 4: Orphan / Data-Consistency Detection
 *
 * Scans for broken relationships between core documents and alerts admins.
 * Runs once at boot (after a delay) and then every 24 hours.
 *
 * Checks:
 *   1. Orders with vendor_id pointing to a non-existent Vendor
 *   2. Shipments with order_id pointing to a non-existent Order
 *   3. Products with vendor_id pointing to a non-existent Vendor
 *   4. Escrow records with order_id pointing to a non-existent Order
 *   5. IntercityOrders (transit_status set) whose transit_rate_id no longer exists
 *
 * Output: admin notification (in-app) + console.warn per category if orphans found.
 * Does NOT delete anything — detection only.
 */

const mongoose = require('mongoose');
const Order            = require('../models/Order.model');
const Shipment         = require('../models/Shipment.model');
const Product          = require('../models/Product.model');
const Escrow           = require('../models/Escrow.model');
const Vendor           = require('../models/Vendor.model');
const LogisticZone     = require('../models/LogisticZone.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const { getCompatibleFirms } = require('./logistics.service');
const { notifyAdmins } = require('../utils/notifier');

const BATCH = 500; // scan in batches to avoid memory spikes

/**
 * Returns ObjectId strings present in `ids` that have no matching doc in `Model`.
 */
async function findMissingRefs(Model, ids) {
  if (!ids.length) return [];
  const unique = [...new Set(ids.map(String))];
  const found = await Model.find({ _id: { $in: unique } }).select('_id').lean();
  const foundSet = new Set(found.map(d => d._id.toString()));
  return unique.filter(id => !foundSet.has(id));
}

async function runOrphanScan(app) {
  if (mongoose.connection.readyState !== 1) return;

  // Critical: broken financial/data references → always notify admins
  const critical = [];
  // Operational: stuck orders, coverage gaps → log only, no notification
  const operational = [];

  try {
    // ── 1. Orders → Vendor (CRITICAL) ────────────────────────────────────────
    const orderVendorIds = await Order.distinct('vendor_id', { payment_status: 'paid' });
    const missingVendors = await findMissingRefs(Vendor, orderVendorIds);
    if (missingVendors.length) {
      const count = await Order.countDocuments({ vendor_id: { $in: missingVendors }, payment_status: 'paid' });
      critical.push(`Orders→Vendor: ${count} paid order(s) reference ${missingVendors.length} deleted vendor(s): ${missingVendors.slice(0, 3).join(', ')}${missingVendors.length > 3 ? '…' : ''}`);
    }

    // ── 2. Escrow → Order (CRITICAL — held funds with no order) ──────────────
    const escrowOrderIds = await Escrow.distinct('order_id', { status: 'held' });
    const missingEscrowOrders = await findMissingRefs(Order, escrowOrderIds);
    if (missingEscrowOrders.length) {
      critical.push(`Escrow→Order: ${missingEscrowOrders.length} held escrow record(s) reference non-existent order(s): ${missingEscrowOrders.slice(0, 3).join(', ')}${missingEscrowOrders.length > 3 ? '…' : ''}`);
    }

    // ── 3. Shipments → Order (CRITICAL) ──────────────────────────────────────
    const shipmentOrderIds = await Shipment.distinct('order_id');
    const missingOrders = await findMissingRefs(Order, shipmentOrderIds);
    if (missingOrders.length) {
      critical.push(`Shipments→Order: ${missingOrders.length} shipment(s) reference non-existent order(s): ${missingOrders.slice(0, 3).join(', ')}${missingOrders.length > 3 ? '…' : ''}`);
    }

    // ── 4. Products → Vendor (operational — no money at risk) ────────────────
    const productVendorIds = await Product.distinct('vendor_id', { status: 'active' });
    const missingProdVendors = await findMissingRefs(Vendor, productVendorIds);
    if (missingProdVendors.length) {
      const count = await Product.countDocuments({ vendor_id: { $in: missingProdVendors }, status: 'active' });
      operational.push(`Products→Vendor: ${count} active product(s) reference ${missingProdVendors.length} deleted vendor(s)`);
    }

    // ── 5. Intercity Orders → IntercityRate (operational) ────────────────────
    if (String(process.env.INTERCITY_ENABLED || '').toLowerCase() === 'true') {
      try {
        const IntercityRate = require('../models/IntercityRate.model');
        const intercityRateIds = await Order.distinct('transit_rate_id', {
          transit_status: { $ne: null },
          transit_rate_id: { $ne: null },
        });
        const missingRates = await findMissingRefs(IntercityRate, intercityRateIds);
        if (missingRates.length) {
          const count = await Order.countDocuments({ transit_rate_id: { $in: missingRates }, transit_status: { $ne: null } });
          operational.push(`IntercityOrders→Rate: ${count} intercity order(s) reference ${missingRates.length} deleted rate(s)`);
        }
      } catch (_) {}
    }

    // ── 6. Stuck food orders (operational — log only) ─────────────────────────
    try {
      const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const stuckCount = await Order.countDocuments({
        food_status:      'rider_arrived',
        rider_arrived_at: { $lte: staleThreshold },
      });
      if (stuckCount > 0) operational.push(`StuckRiderArrived: ${stuckCount} food order(s) stuck in 'rider_arrived' for > 30 min`);
    } catch (_) {}

    try {
      const staleReadyThreshold = new Date(Date.now() - 45 * 60 * 1000);
      const stuckReadyCount = await Order.countDocuments({
        food_status:     'ready',
        shipping_method: 'logistics_partner',
        status_logs: { $elemMatch: { status: 'ready', timestamp: { $lte: staleReadyThreshold } } },
      });
      if (stuckReadyCount > 0) operational.push(`StuckLogisticsReady: ${stuckReadyCount} food order(s) in 'ready' with no rider for > 45 min`);
    } catch (_) {}

    // ── 7. Zero-coverage zones (operational — log only) ───────────────────────
    try {
      const activeCities = await LogisticZone.find({ type: 'city', is_active: true }).select('_id name').lean();
      const zeroCoverageCities = [];
      for (const city of activeCities) {
        const zonesInCity = await LogisticZone.find({
          $or: [{ ancestors: city._id }, { _id: city._id }],
          is_active: true,
        }).select('_id').lean();
        const firmCount = await LogisticsCompany.countDocuments({
          is_active:   true,
          is_verified: true,
          'quartier_prices.zone_id': { $in: zonesInCity.map(z => z._id) },
        });
        if (firmCount === 0) zeroCoverageCities.push(city.name);
      }
      if (zeroCoverageCities.length) {
        operational.push(`ZeroCoverage: ${zeroCoverageCities.length} city zone(s) with no verified logistics firm: ${zeroCoverageCities.join(', ')}`);
      }
    } catch (_) {}

    // ── Report ────────────────────────────────────────────────────────────────
    if (critical.length === 0 && operational.length === 0) {
      console.log('[orphanDetector] Scan complete — no issues found.');
      return;
    }

    if (operational.length) {
      console.warn(`[orphanDetector] Operational (log only):\n• ${operational.join('\n• ')}`);
    }

    if (critical.length) {
      console.warn(`[orphanDetector] CRITICAL — admin notified:\n• ${critical.join('\n• ')}`);
      if (app) {
        await notifyAdmins(app, {
          title:    'Data Integrity Alert',
          message:  `${critical.length} critical issue(s) require attention. Review server logs.`,
          type:     'system_alert',
          metadata: { issues: critical, link: '/admin/system' },
        });
      }
    }
  } catch (err) {
    console.error('[orphanDetector] scan error:', err.message);
  }
}

/**
 * Register the orphan detector.
 * First run: 5 minutes after boot (let other services settle).
 * Subsequent runs: every 24 hours.
 *
 * @param {import('express').Application} app
 */
function startOrphanDetector(app) {
  const FIRST_RUN_DELAY_MS  = 60 * 60 * 1000;      // 1 hour — avoids spam on rapid restarts/deploys
  const INTERVAL_MS         = 24 * 60 * 60 * 1000; // 24 h

  setTimeout(() => {
    runOrphanScan(app);
    const interval = setInterval(() => runOrphanScan(app), INTERVAL_MS);
    if (interval.unref) interval.unref();
  }, FIRST_RUN_DELAY_MS);

  console.log('[orphanDetector] Scheduled — first scan in 1 h, then every 24 h.');
}

module.exports = { startOrphanDetector, runOrphanScan };
