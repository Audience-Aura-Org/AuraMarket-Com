/**
 * services/webhookHealthMonitor.service.js
 * Auradime — Lightweight In-Memory Webhook Health Tracker
 *
 * Tracks webhook receive/reject/settle counts per gateway per hour.
 * The stale cleanup worker logs a summary each sweep so ops can spot
 * webhook delivery problems (e.g. signature bugs, IP changes) before
 * they cause financial impact.
 *
 * Not persisted — counters reset on process restart and every hour.
 */

'use strict';

const counters = {
  received: {},   // { pawapay: 5, eversend: 3, payunit: 1 }
  rejected: {},   // { pawapay: 2 }
  webhookSettled: {},
  cronSettled: {},
};

const rejectionReasons = {}; // { pawapay: { 'digest-mismatch': 2 } }

let lastResetAt = Date.now();
const RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const inc = (bucket, gateway) => {
  counters[bucket][gateway] = (counters[bucket][gateway] || 0) + 1;
};

/**
 * Record a webhook event.
 * @param {'received'|'rejected'|'webhookSettled'|'cronSettled'} event
 * @param {string} gateway - 'pawapay', 'eversend', 'payunit'
 * @param {string} [reason] - rejection reason (only for 'rejected')
 */
const record = (event, gateway, reason) => {
  if (!counters[event]) return;
  inc(event, gateway);
  if (event === 'rejected' && reason) {
    if (!rejectionReasons[gateway]) rejectionReasons[gateway] = {};
    rejectionReasons[gateway][reason] = (rejectionReasons[gateway][reason] || 0) + 1;
  }
};

/**
 * Get current counters snapshot + reset if the hour window has elapsed.
 */
const getAndMaybeReset = () => {
  const snapshot = {
    received: { ...counters.received },
    rejected: { ...counters.rejected },
    webhookSettled: { ...counters.webhookSettled },
    cronSettled: { ...counters.cronSettled },
    rejectionReasons: JSON.parse(JSON.stringify(rejectionReasons)),
    windowMs: Date.now() - lastResetAt,
  };

  if (Date.now() - lastResetAt >= RESET_INTERVAL_MS) {
    for (const key of Object.keys(counters)) counters[key] = {};
    for (const key of Object.keys(rejectionReasons)) delete rejectionReasons[key];
    lastResetAt = Date.now();
  }

  return snapshot;
};

/**
 * Log a health summary. Called by the stale cleanup worker each sweep.
 */
const logSummary = () => {
  const s = getAndMaybeReset();
  const totalReceived = Object.values(s.received).reduce((a, b) => a + b, 0);
  const totalRejected = Object.values(s.rejected).reduce((a, b) => a + b, 0);
  const totalWebhookSettled = Object.values(s.webhookSettled).reduce((a, b) => a + b, 0);
  const totalCronSettled = Object.values(s.cronSettled).reduce((a, b) => a + b, 0);

  if (totalReceived + totalRejected + totalCronSettled === 0) return; // nothing to report

  const windowMins = Math.round(s.windowMs / 60000);
  console.log(
    `[WebhookHealth] Last ${windowMins}m — received=${totalReceived} rejected=${totalRejected} ` +
    `webhookSettled=${totalWebhookSettled} cronSettled=${totalCronSettled}`
  );

  // Per-gateway breakdown
  const gateways = new Set([
    ...Object.keys(s.received),
    ...Object.keys(s.rejected),
    ...Object.keys(s.cronSettled),
  ]);
  for (const gw of gateways) {
    const parts = [];
    if (s.received[gw]) parts.push(`recv=${s.received[gw]}`);
    if (s.rejected[gw]) parts.push(`reject=${s.rejected[gw]}`);
    if (s.webhookSettled[gw]) parts.push(`whSettled=${s.webhookSettled[gw]}`);
    if (s.cronSettled[gw]) parts.push(`cronSettled=${s.cronSettled[gw]}`);
    if (parts.length) console.log(`[WebhookHealth]   ${gw}: ${parts.join(', ')}`);
  }

  // Alert if too many settlements came from cron instead of webhooks
  if (totalCronSettled > 0 && totalWebhookSettled + totalCronSettled > 0) {
    const cronRatio = totalCronSettled / (totalWebhookSettled + totalCronSettled);
    if (cronRatio > 0.3) {
      console.error(
        `[WebhookHealth] WARNING: ${Math.round(cronRatio * 100)}% of settlements came from cron, ` +
        `not webhooks. Webhook delivery may be impaired.`
      );
    }
  }

  // Alert on high rejection rate
  if (totalRejected > 0 && totalReceived > 0) {
    const rejectRate = totalRejected / totalReceived;
    if (rejectRate > 0.1) {
      console.error(
        `[WebhookHealth] WARNING: ${Math.round(rejectRate * 100)}% webhook rejection rate.`
      );
      for (const [gw, reasons] of Object.entries(s.rejectionReasons)) {
        for (const [reason, count] of Object.entries(reasons)) {
          console.error(`[WebhookHealth]   ${gw}: ${reason} ×${count}`);
        }
      }
    }
  }
};

module.exports = { record, logSummary, getAndMaybeReset };
