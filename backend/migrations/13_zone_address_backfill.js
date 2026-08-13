/**
 * Migration 13 — Backfill zone_id on User addresses, Order shipping_address,
 *                and Shipment pickup_address / delivery_address
 *
 * Phase 1-B Step 6. Lower-priority than Steps 1–5 (does not block logistics
 * matching), but needed before string fallbacks in getCompatibleFirms can be
 * safely removed.
 *
 * Strategy:
 *   1. Build an in-memory lookup: lowercase(zone.name) → zone._id (quartiers first,
 *      then districts as fallback) for all active LogisticZones.
 *   2. Iterate User.addresses[] — for each sub-doc without zone_id, try to match
 *      on quartier → city (in that priority order). Log misses.
 *   3. Iterate Order.shipping_address — same match logic.
 *   4. Iterate Shipment.pickup_address + delivery_address — same match logic.
 *
 * Idempotent: skips any sub-doc that already has zone_id set.
 *
 * Run: node backend/migrations/13_zone_address_backfill.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[13] Connected to MongoDB');

  const LogisticZone = require('../models/LogisticZone.model');
  const User         = require('../models/User.model');
  const Order        = require('../models/Order.model');
  const Shipment     = require('../models/Shipment.model');

  // ── Build zone name lookup ────────────────────────────────────────────────
  // Priority: quartier (most specific) → district → city
  // When two zones share a name, the more-specific one wins.
  const TYPE_PRIORITY = { quartier: 0, district: 1, city: 2 };

  const allZones = await LogisticZone.find({ is_active: { $ne: false } })
    .select('name type _id')
    .lean();

  const zoneByName = new Map();
  // Sort by priority so more-specific zones overwrite city-level zones in the map
  allZones
    .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9))
    .forEach(z => {
      const key = (z.name || '').toLowerCase().trim();
      if (key) zoneByName.set(key, z._id);
    });

  console.log(`[13] Zone lookup built: ${zoneByName.size} entries`);

  const resolveZone = (address) => {
    if (!address) return null;
    const candidates = [
      address.quartier,
      address.city,
      address.region,
    ];
    for (const name of candidates) {
      if (!name) continue;
      const id = zoneByName.get(name.toLowerCase().trim());
      if (id) return id;
    }
    return null;
  };

  let stats = {
    users_checked: 0, user_addrs_updated: 0, user_addrs_skipped: 0, user_addrs_miss: 0,
    orders_updated: 0, orders_skipped: 0, orders_miss: 0,
    shipments_updated: 0, shipments_skipped: 0, shipments_miss: 0,
  };
  const misses = [];

  // ── 1. User addresses ─────────────────────────────────────────────────────
  const userCursor = User.find({ 'addresses.0': { $exists: true } })
    .select('addresses')
    .cursor({ batchSize: 100 });

  for await (const user of userCursor) {
    stats.users_checked += 1;
    let dirty = false;

    for (const addr of user.addresses) {
      if (addr.zone_id) { stats.user_addrs_skipped += 1; continue; }
      const id = resolveZone(addr);
      if (id) {
        addr.zone_id = id;
        dirty = true;
        stats.user_addrs_updated += 1;
      } else {
        stats.user_addrs_miss += 1;
        misses.push(`User ${user._id} addr quartier="${addr.quartier}" city="${addr.city}"`);
      }
    }

    if (dirty) await user.save();
  }
  console.log(`[13] Users: checked=${stats.users_checked} updated=${stats.user_addrs_updated} skipped=${stats.user_addrs_skipped} miss=${stats.user_addrs_miss}`);

  // ── 2. Order shipping_address ─────────────────────────────────────────────
  const orderCursor = Order.find({
    shipping_address: { $exists: true, $ne: null },
    'shipping_address.zone_id': null,
  })
    .select('shipping_address')
    .cursor({ batchSize: 100 });

  for await (const order of orderCursor) {
    const id = resolveZone(order.shipping_address);
    if (id) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { 'shipping_address.zone_id': id } }
      );
      stats.orders_updated += 1;
    } else {
      stats.orders_miss += 1;
      misses.push(`Order ${order._id} shipping quartier="${order.shipping_address?.quartier}" city="${order.shipping_address?.city}"`);
    }
  }
  console.log(`[13] Orders: updated=${stats.orders_updated} miss=${stats.orders_miss}`);

  // ── 3. Shipment pickup_address + delivery_address ─────────────────────────
  const shipmentCursor = Shipment.find({})
    .select('pickup_address delivery_address')
    .cursor({ batchSize: 100 });

  for await (const shipment of shipmentCursor) {
    let dirty = false;
    const update = {};

    if (shipment.pickup_address && !shipment.pickup_address.zone_id) {
      const id = resolveZone(shipment.pickup_address);
      if (id) { update['pickup_address.zone_id'] = id; dirty = true; stats.shipments_updated += 1; }
      else {
        stats.shipments_miss += 1;
        misses.push(`Shipment ${shipment._id} pickup quartier="${shipment.pickup_address?.quartier}"`);
      }
    } else { stats.shipments_skipped += 1; }

    if (shipment.delivery_address && !shipment.delivery_address.zone_id) {
      const id = resolveZone(shipment.delivery_address);
      if (id) { update['delivery_address.zone_id'] = id; dirty = true; stats.shipments_updated += 1; }
      else {
        stats.shipments_miss += 1;
        misses.push(`Shipment ${shipment._id} delivery quartier="${shipment.delivery_address?.quartier}"`);
      }
    } else { stats.shipments_skipped += 1; }

    if (dirty) {
      await Shipment.updateOne({ _id: shipment._id }, { $set: update });
    }
  }
  console.log(`[13] Shipments: updated=${stats.shipments_updated} skipped=${stats.shipments_skipped} miss=${stats.shipments_miss}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n[13] === Migration 13 complete ===');
  if (misses.length) {
    console.warn(`[13] ${misses.length} unresolved address(es) — zone_id left null, manual review needed:`);
    misses.forEach(m => console.warn('  ', m));
    process.exitCode = 1; // Signal partial completion for CI
  } else {
    console.log('[13] All addresses resolved. Zero misses.');
  }

  await mongoose.disconnect();
})();
