/**
 * services/scheduledPickupDispatch.service.js
 * Auradime — Scheduled Pickup Dispatch Worker
 *
 * Processes P2P shipments with scheduled_pickup timestamps that have passed.
 * When a scheduled pickup time arrives, this worker:
 *   1. Marks shipment as "assigned" (if not already)
 *   2. Sends notification to logistics provider
 *   3. Sends notification to booker
 *
 * Runs every 5 minutes to catch scheduled pickups promptly.
 *
 * Registered in server.js — first run 1 min after boot, then every 5 min.
 */

const mongoose = require('mongoose');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const User = require('../models/User.model');
const { sendNotification } = require('../utils/notifier');
const { sendEmail } = require('../utils/emailService');
const { sendShipmentStatusSMS } = require('../utils/smsService');
const { withLock } = require('../utils/locks');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_TTL_SECONDS = Math.ceil(INTERVAL_MS / 1000) + 60;

let _timer = null;

async function runScheduledPickupDispatch(app) {
  if (mongoose.connection.readyState !== 1) return;

  await withLock('worker:scheduled-pickup-dispatch', LOCK_TTL_SECONDS, async () => {
    try {
      const now = new Date();

      // Find P2P shipments with scheduled_pickup time in the past, not yet assigned
      const shipments = await Shipment.find({
        type: 'p2p',
        status: 'pending',
        scheduled_pickup: { $lte: now, $ne: null },
      }).populate('logistics_id booked_by other_party.user_id');

      if (!shipments.length) return;

      console.log(`[scheduledPickupDispatch] Found ${shipments.length} scheduled pickup(s) to process.`);

      for (const shipment of shipments) {
        try {
          // Update status to assigned
          shipment.status = 'assigned';
          shipment.shipment_logs.push({
            status: 'assigned',
            updated_by: null,
            note: 'Automatic dispatch from scheduled pickup time',
            timestamp: new Date(),
          });
          await shipment.save();

          console.log(`[scheduledPickupDispatch] Dispatched shipment ${shipment.tracking_code}`);

          // Non-blocking notifications
          setImmediate(async () => {
            try {
              // Notify logistics provider
              if (shipment.logistics_id?.user_id) {
                await sendNotification(app, shipment.logistics_id.user_id, {
                  title: 'Pickup Ready',
                  message: `Shipment ${shipment.tracking_code} is ready for pickup at scheduled time.`,
                  type: 'p2p_pickup',
                  metadata: { target_id: shipment._id, tracking_code: shipment.tracking_code },
                });
              }

              // Notify booker (user or guest)
              if (shipment.booked_by) {
                await sendNotification(app, shipment.booked_by._id, {
                  title: 'Pickup Dispatched',
                  message: `Your scheduled pickup ${shipment.tracking_code} has been dispatched.`,
                  type: 'p2p_pickup',
                  metadata: { target_id: shipment._id, tracking_code: shipment.tracking_code },
                });

                // Send email to booker
                try {
                  if (shipment.booked_by.email) {
                    await sendEmail({
                      to: shipment.booked_by.email,
                      subject: `Pickup Ready: ${shipment.tracking_code}`,
                      template: 'p2p_pickup_ready',
                      data: {
                        tracking_code: shipment.tracking_code,
                        pickup_address: shipment.pickup_address,
                        delivery_address: shipment.delivery_address,
                        provider: shipment.logistics_id?.company_name || 'Delivery Partner',
                      },
                    });
                  }
                } catch (emailErr) {
                  console.warn('[scheduledPickupDispatch] Email to booker failed:', emailErr.message);
                }

                // Send SMS to booker
                try {
                  if (shipment.booked_by.phone) {
                    await sendShipmentStatusSMS(shipment.booked_by.phone, shipment.tracking_code, 'assigned');
                  }
                } catch (smsErr) {
                  console.warn('[scheduledPickupDispatch] SMS to booker failed:', smsErr.message);
                }
              } else if (shipment.guest_booker?.email || shipment.guest_booker?.phone) {
                // Send email to guest booker
                try {
                  if (shipment.guest_booker.email) {
                    await sendEmail({
                      to: shipment.guest_booker.email,
                      subject: `Pickup Ready: ${shipment.tracking_code}`,
                      template: 'p2p_pickup_ready',
                      data: {
                        tracking_code: shipment.tracking_code,
                        pickup_address: shipment.pickup_address,
                        delivery_address: shipment.delivery_address,
                        provider: shipment.logistics_id?.company_name || 'Delivery Partner',
                      },
                    });
                  }
                } catch (emailErr) {
                  console.warn('[scheduledPickupDispatch] Email to guest booker failed:', emailErr.message);
                }

                // Send SMS to guest booker
                try {
                  if (shipment.guest_booker.phone) {
                    await sendShipmentStatusSMS(shipment.guest_booker.phone, shipment.tracking_code, 'assigned');
                  }
                } catch (smsErr) {
                  console.warn('[scheduledPickupDispatch] SMS to guest booker failed:', smsErr.message);
                }
              }

              // Notify logistics provider email
              if (shipment.logistics_id?.email) {
                try {
                  await sendEmail({
                    to: shipment.logistics_id.email,
                    subject: `New Pickup: ${shipment.tracking_code}`,
                    template: 'p2p_provider_new_pickup',
                    data: {
                      tracking_code: shipment.tracking_code,
                      pickup_address: shipment.pickup_address,
                      delivery_address: shipment.delivery_address,
                      booker_name: shipment.booked_by ? 'Registered User' : shipment.guest_booker?.name,
                      booker_phone: shipment.booked_by ? undefined : shipment.guest_booker?.phone,
                    },
                  });
                } catch (emailErr) {
                  console.warn('[scheduledPickupDispatch] Email to provider failed:', emailErr.message);
                }
              }
            } catch (notifyErr) {
              console.error('[scheduledPickupDispatch] notification error:', notifyErr.message);
            }
          });
        } catch (err) {
          console.error(`[scheduledPickupDispatch] Failed to dispatch shipment ${shipment._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[scheduledPickupDispatch] worker error:', err.message);
    }
  }).catch((err) => {
    console.error('[scheduledPickupDispatch] lock failed:', err.message);
  });
}

/**
 * Register the scheduled pickup dispatch worker.
 * First run: 1 minute after boot
 * Subsequent runs: every 5 minutes
 *
 * @param {import('express').Application} app
 */
function startScheduledPickupDispatchWorker(app) {
  if (_timer) return;
  const FIRST_RUN_MS = 1 * 60 * 1000; // 1 min

  setTimeout(() => {
    runScheduledPickupDispatch(app).catch((err) =>
      console.error('[scheduledPickupDispatch] initial run failed:', err.message)
    );
    _timer = setInterval(() => {
      runScheduledPickupDispatch(app).catch((err) =>
        console.error('[scheduledPickupDispatch] interval failed:', err.message)
      );
    }, INTERVAL_MS);
    if (_timer.unref) _timer.unref();
  }, FIRST_RUN_MS);

  console.log('[scheduledPickupDispatch] Worker scheduled — first run in 1 min, then every 5 min.');
}

function stopScheduledPickupDispatchWorker() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startScheduledPickupDispatchWorker, runScheduledPickupDispatch, stopScheduledPickupDispatchWorker };
