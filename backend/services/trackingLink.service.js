/**
 * services/trackingLink.service.js
 * Secure, shareable tracking links: https://auradime.com/delivery/track?t=<token>
 *
 * - The token is 24 random bytes (base64url, 32 chars): unguessable, unlike codes.
 * - Only its SHA-256 hash is stored, so a database leak does not yield working links.
 * - Creating a new link replaces the old one (the old link stops working).
 * - Links expire TRACKING_LINK_TTL_AFTER_DELIVERY_H hours after delivery/cancellation.
 */
const crypto = require('crypto');

const HOURS_AFTER_DONE = Number(process.env.TRACKING_LINK_TTL_AFTER_DELIVERY_H || 72);
const FINISHED = ['delivered', 'failed', 'cancelled'];

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const webOrigin = () => {
  const url = process.env.WEB_CLIENT_URL || 'https://auradime.com';
  return /localhost|127\.0\.0\.1/.test(url) ? 'https://auradime.com' : url.replace(/\/+$/, '');
};

const linkFor = (token) => `${webOrigin()}/delivery/track?t=${token}`;

/** Issues a new token on the (unsaved) shipment document and returns the plain token. */
const issueToken = (shipment) => {
  const token = crypto.randomBytes(24).toString('base64url');
  shipment.tracking_token_hash = hashToken(token);
  shipment.tracking_token_issued_at = new Date();
  return token;
};

/** When a finished shipment's link stops working (null = still active). */
const expiresAt = (shipment) => {
  if (!FINISHED.includes(shipment.status)) return null;
  const done = [...(shipment.shipment_logs || [])].reverse().find((l) => FINISHED.includes(l.status))?.timestamp || shipment.updatedAt;
  return done ? new Date(new Date(done).getTime() + HOURS_AFTER_DONE * 3600 * 1000) : null;
};

const isExpired = (shipment, now = new Date()) => {
  const at = expiresAt(shipment);
  return Boolean(at && at <= now);
};

/** WhatsApp share text for the agency operator (opened with wa.me — no paid API). */
const whatsappText = ({ agencyName, reference, link, recipientName }) => [
  `Hello${recipientName ? ` ${recipientName}` : ''}, ${agencyName} is delivering your package${reference ? ` (${reference})` : ''}.`,
  `Follow it here: ${link}`,
  'Please keep your phone on so the rider can reach you.',
].join('\n');

module.exports = { hashToken, issueToken, linkFor, expiresAt, isExpired, whatsappText, FINISHED };
