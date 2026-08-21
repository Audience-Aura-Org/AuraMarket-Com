/**
 * services/cancelRateMonitor.service.js
 * Auradime — Restaurant Cancellation-Rate Monitor
 *
 * Phase 3 Step 5b: Checks each restaurant vendor's cancellation / refund rate
 * over a rolling window. If the rate exceeds the configured threshold, the vendor
 * is re-flagged to held settlement (same mechanics as the new-restaurant hold).
 * Admin receives a notification on each flip.
 *
 * Admin can set `Vendor.cancel_rate_hold_override = true` to exempt a vendor
 * from this monitor permanently.
 *
 * Settings read from PlatformSettings:
 *   restaurant_cancel_rate_threshold  — float 0–1, default 0.25 (25 %)
 *   restaurant_cancel_rate_window_days — integer, default 30
 *   new_restaurant_hold_order_count   — integer, default 5
 *     (vendors still in initial hold are not re-evaluated by this monitor)
 *
 * Run interval: every 6 hours (cancel rate is not second-sensitive).
 */

const Vendor = require('../models/Vendor.model');
const Order  = require('../models/Order.model');
const User   = require('../models/User.model');
const { sendNotification, notifyAdmins } = require('../utils/notifier');
const { withLock } = require('../utils/locks');

const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LOCK_TTL_SECONDS = Math.ceil(RUN_INTERVAL_MS / 1000) + 60;

let timer = null;

/**
 * Compute the cancel/refund rate for a single restaurant vendor over the window.
 *
 * @param {string|ObjectId} vendorId
 * @param {Date}            since     — start of the rolling window
 * @returns {Promise<{ rate: number, total: number, cancelled: number }>}
 */
const computeCancelRate = async (vendorId, since) => {
  const [total, cancelled] = await Promise.all([
    Order.countDocuments({
      vendor_id:    vendorId,
      food_status:  { $exists: true, $ne: null },
      createdAt:    { $gte: since },
      // Exclude auto-cancelled orders (acceptance timeout) from denominator
      // — those are system failures, not vendor failures.
      // Only manually placed orders where payment was captured count.
      payment_status: { $in: ['paid', 'refunded'] },
    }),
    Order.countDocuments({
      vendor_id:      vendorId,
      // Exclude timed_out (auto-cancelled by system) — those are platform failures, not vendor failures
      food_status:    { $exists: true, $nin: [null, 'timed_out'] },
      createdAt:      { $gte: since },
      payment_status: { $in: ['paid', 'refunded'] },
      order_status:   { $in: ['cancelled', 'refunded'] },
    }),
  ]);

  return {
    total,
    cancelled,
    rate: total > 0 ? cancelled / total : 0,
  };
};

const runCancelRateMonitor = async (app) => {
  const result = await withLock('worker:cancel-rate-monitor', LOCK_TTL_SECONDS, async () => {
  let checked = 0;
  let flipped = 0;
  let cleared = 0;

  try {
    const PlatformSettings = require('../models/PlatformSettings.model');
    const ps = await PlatformSettings.getSettings();

    const threshold   = ps.restaurant_cancel_rate_threshold  ?? 0.25;
    const windowDays  = ps.restaurant_cancel_rate_window_days ?? 30;
    const holdCount   = ps.new_restaurant_hold_order_count    ?? 5;

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Only evaluate restaurant vendors that have graduated from initial hold
    // AND have not been admin-overridden.
    const restaurants = await Vendor.find({
      vendor_type:               'restaurant',
      cancel_rate_hold_override: { $ne: true },
    }).select('_id user_id cancel_rate_hold cancel_rate_hold_since').lean();

    for (const vendor of restaurants) {
      try {
        // Check if the vendor has graduated from the initial hold
        const completedCount = await Order.countDocuments({
          vendor_id:      vendor._id,
          food_status:    'delivered',
          payment_status: 'paid',
        });

        if (completedCount < holdCount) {
          // Still in initial hold — skip; new_restaurant_hold already covers them
          continue;
        }

        checked += 1;
        const { rate, total, cancelled } = await computeCancelRate(vendor._id, since);

        if (rate > threshold && !vendor.cancel_rate_hold) {
          // Flip to held settlement
          await Vendor.findByIdAndUpdate(vendor._id, {
            $set: {
              cancel_rate_hold:       true,
              cancel_rate_hold_since: new Date(),
            },
          });
          flipped += 1;

          // Notify all admins with email (notifyAdmins has sendEmail: true built-in)
          await notifyAdmins(app, {
            title:    'Restaurant Cancel Rate Alert',
            message:  `Vendor ${vendor._id.toString().slice(-6).toUpperCase()} auto-flagged: ${Math.round(rate * 100)}% cancellation rate (${cancelled}/${total} orders, last ${windowDays} days). Payouts held until delivery. Review or override in the vendor dashboard.`,
            type:     'system_alert',
            metadata: { vendor_id: vendor._id, link: `/admin/vendors/${vendor._id}` },
          }).catch(() => {});

          console.log(`[cancelRateMonitor] vendor ${vendor._id} flipped to cancel_rate_hold (rate: ${Math.round(rate * 100)}%)`);
        } else if (rate <= threshold && vendor.cancel_rate_hold) {
          // Rate has recovered — but enforce a minimum 24h hold before auto-release
          // to prevent rapid flipping (and admin notification spam) when the rate
          // bounces just above/below the threshold on consecutive 6-hour scans.
          const MINIMUM_HOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
          const heldSince = vendor.cancel_rate_hold_since ? new Date(vendor.cancel_rate_hold_since) : null;
          const heldLongEnough = heldSince && (Date.now() - heldSince.getTime()) >= MINIMUM_HOLD_MS;
          if (!heldLongEnough) continue; // still within the minimum hold window — skip

          // Clear the hold automatically
          await Vendor.findByIdAndUpdate(vendor._id, {
            $set: {
              cancel_rate_hold:       false,
              cancel_rate_hold_since: null,
            },
          });
          cleared += 1;

          await notifyAdmins(app, {
            title:    'Restaurant Cancel Rate Recovered',
            message:  `Vendor ${vendor._id.toString().slice(-6).toUpperCase()} cancel rate dropped to ${Math.round(rate * 100)}%. Hold released automatically.`,
            type:     'system_alert',
            metadata: { vendor_id: vendor._id, link: `/admin/vendors/${vendor._id}` },
          }).catch(() => {});

          console.log(`[cancelRateMonitor] vendor ${vendor._id} cancel_rate_hold cleared (rate: ${Math.round(rate * 100)}%)`);
        }
      } catch (vendorErr) {
        console.error(`[cancelRateMonitor] error processing vendor ${vendor._id}:`, vendorErr.message);
      }
    }
  } catch (err) {
    console.error('[cancelRateMonitor] scan failed:', err.message);
  }

  return { checked, flipped, cleared, skipped: false };
  }).catch((err) => {
    console.error('[cancelRateMonitor] lock failed:', err.message);
    return { checked: 0, flipped: 0, cleared: 0, skipped: false };
  });

  return result ?? { checked: 0, flipped: 0, cleared: 0, skipped: true };
};

const startCancelRateMonitor = (app) => {
  if (timer) return;

  // First run 3 min after boot (after other workers have started)
  setTimeout(() => {
    runCancelRateMonitor(app).catch(err =>
      console.error('[cancelRateMonitor] initial run failed:', err.message)
    );
  }, 3 * 60 * 1000);

  timer = setInterval(() => {
    runCancelRateMonitor(app).catch(err =>
      console.error('[cancelRateMonitor] interval failed:', err.message)
    );
  }, RUN_INTERVAL_MS);

  if (timer.unref) timer.unref();
};

const stopCancelRateMonitor = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

module.exports = { startCancelRateMonitor, runCancelRateMonitor, stopCancelRateMonitor };
