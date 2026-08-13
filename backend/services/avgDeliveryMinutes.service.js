/**
 * services/avgDeliveryMinutes.service.js
 * Auradime — Background: [B §2.8] avg_delivery_minutes per Logistics Firm
 *
 * Computes the rolling average travel time (picked_up_at → delivered_at) for each
 * logistics company using the accurate timestamps stamped on food orders.
 *
 * Falls back to the Shipment updatedAt-createdAt proxy for firms that have no
 * food orders with the new timestamps yet (backward-compat during transition).
 *
 * Only counts data from the last 90 days (rolling window).
 * Minimum 3 samples required before updating the stored average.
 *
 * Registered in server.js — first run 10 min after boot, then every 24 h.
 */

const mongoose = require('mongoose');
const Order            = require('../models/Order.model');
const Shipment         = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');

const WINDOW_DAYS = 90;
const MIN_SAMPLES = 3; // don't compute average from fewer than 3 deliveries

async function runAvgDeliveryMinutesUpdate() {
  if (mongoose.connection.readyState !== 1) return;

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000);

  try {
    // ── Primary: accurate picked_up_at → delivered_at from food orders ───────
    const accurateResults = await Order.aggregate([
      {
        $match: {
          food_status:          'delivered',
          logistics_company_id: { $ne: null },
          picked_up_at:         { $ne: null, $gte: windowStart },
          delivered_at:         { $ne: null },
        },
      },
      {
        $project: {
          logistics_company_id: 1,
          // Actual rider travel time: pickup to doorstep, excludes kitchen wait
          elapsed_ms: { $subtract: ['$delivered_at', '$picked_up_at'] },
        },
      },
      { $match: { elapsed_ms: { $gt: 0 } } },
      {
        $group: {
          _id:    '$logistics_company_id',
          count:  { $sum: 1 },
          avg_ms: { $avg: '$elapsed_ms' },
        },
      },
      { $match: { count: { $gte: MIN_SAMPLES } } },
    ]);

    const coveredFirmIds = new Set(accurateResults.map(r => r._id.toString()));

    // ── Fallback: Shipment updatedAt-createdAt for firms without new data ─────
    const fallbackResults = await Shipment.aggregate([
      {
        $match: {
          status:       'delivered',
          updatedAt:    { $gte: windowStart },
          logistics_id: {
            $nin: [...coveredFirmIds].map(id => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      {
        $project: {
          logistics_id: 1,
          elapsed_ms:   { $subtract: ['$updatedAt', '$createdAt'] },
        },
      },
      { $match: { elapsed_ms: { $gt: 0 } } },
      {
        $group: {
          _id:    '$logistics_id',
          count:  { $sum: 1 },
          avg_ms: { $avg: '$elapsed_ms' },
        },
      },
      { $match: { count: { $gte: MIN_SAMPLES } } },
    ]);

    const combined = [
      ...accurateResults.map(r => ({ _id: r._id, avg_ms: r.avg_ms })),
      ...fallbackResults.map(r => ({ _id: r._id, avg_ms: r.avg_ms })),
    ];

    if (!combined.length) {
      console.log('[avgDeliveryMinutes] No qualifying deliveries found — skipping update.');
      return;
    }

    const now = new Date();
    const bulkOps = combined.map(({ _id, avg_ms }) => ({
      updateOne: {
        filter: { _id },
        update: {
          $set: {
            avg_delivery_minutes:            Math.max(1, Math.round(avg_ms / 60000)),
            avg_delivery_minutes_updated_at: now,
          },
        },
      },
    }));

    await LogisticsCompany.bulkWrite(bulkOps, { ordered: false });
    console.log(
      `[avgDeliveryMinutes] Updated ${combined.length} firm(s)` +
      ` (${accurateResults.length} accurate, ${fallbackResults.length} fallback).`
    );
  } catch (err) {
    console.error('[avgDeliveryMinutes] Update error:', err.message);
  }
}

/**
 * Register the avg_delivery_minutes update job.
 * First run: 10 min after boot (shipments and firms are loaded by then).
 * Subsequent runs: every 24 hours.
 */
function startAvgDeliveryMinutesJob() {
  const FIRST_RUN_MS = 10 * 60 * 1000;      // 10 min
  const INTERVAL_MS  = 24 * 60 * 60 * 1000; // 24 h

  setTimeout(() => {
    runAvgDeliveryMinutesUpdate();
    const t = setInterval(runAvgDeliveryMinutesUpdate, INTERVAL_MS);
    if (t.unref) t.unref();
  }, FIRST_RUN_MS);

  console.log('[avgDeliveryMinutes] Job scheduled — first run in 10 min, then every 24 h.');
}

module.exports = { startAvgDeliveryMinutesJob, runAvgDeliveryMinutesUpdate };
