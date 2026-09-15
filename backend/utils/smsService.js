/**
 * utils/smsService.js
 * Auradime — SMS Notification Service
 *
 * Supports multiple SMS providers (Twilio, Africa's Talking, etc.)
 * Graceful fallback — if SMS fails, continues processing (non-critical)
 */

const {
  SMS_PROVIDER,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  AFRICAS_TALKING_API_KEY,
  AFRICAS_TALKING_USERNAME,
  SMS_ENABLED,
} = require('../config/env');

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(phoneNumber, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  const twilio = require('twilio');
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const result = await client.messages.create({
    body: message,
    from: TWILIO_PHONE_NUMBER,
    to: phoneNumber,
  });

  return { success: true, provider: 'twilio', message_id: result.sid };
}

/**
 * Send SMS via Africa's Talking
 */
async function sendViaAfricasTalking(phoneNumber, message) {
  if (!AFRICAS_TALKING_API_KEY || !AFRICAS_TALKING_USERNAME) {
    throw new Error('Africa\'s Talking credentials not configured');
  }

  const AfricasTalking = require('africastalking');
  const AfricasTalkingClient = AfricasTalking({
    apiKey: AFRICAS_TALKING_API_KEY,
    username: AFRICAS_TALKING_USERNAME,
  });

  const sms = AfricasTalkingClient.SMS;
  const result = await sms.send({
    recipients: [phoneNumber],
    message: message,
  });

  return { success: true, provider: 'africas_talking', message_id: result.data?.recipients[0]?.messageId };
}

/**
 * Send SMS with automatic provider selection
 * @param {string} phoneNumber - E.164 format phone number (e.g. +237672123456)
 * @param {string} message - SMS message body (max 160 chars recommended)
 * @returns {Promise<object>} Result with success, provider, message_id
 */
async function sendSMS(phoneNumber, message) {
  if (!SMS_ENABLED || !SMS_PROVIDER) {
    console.log('[SMS] SMS disabled or provider not configured — skipping:', phoneNumber);
    return { success: false, reason: 'SMS disabled' };
  }

  if (!phoneNumber || !/^\+?[0-9]{7,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
    console.warn('[SMS] Invalid phone number format:', phoneNumber);
    return { success: false, reason: 'Invalid phone number' };
  }

  if (!message || message.length > 1000) {
    console.warn('[SMS] Invalid message length:', message?.length);
    return { success: false, reason: 'Invalid message' };
  }

  try {
    if (SMS_PROVIDER === 'twilio') {
      return await sendViaTwilio(phoneNumber, message);
    } else if (SMS_PROVIDER === 'africas_talking') {
      return await sendViaAfricasTalking(phoneNumber, message);
    } else {
      throw new Error(`Unknown SMS provider: ${SMS_PROVIDER}`);
    }
  } catch (err) {
    console.error(`[SMS] Failed to send via ${SMS_PROVIDER}:`, err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Send shipment status update SMS to recipient
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} trackingCode - Shipment tracking code
 * @param {string} status - New shipment status
 */
async function sendShipmentStatusSMS(phoneNumber, trackingCode, status) {
  const statusLabels = {
    pending: 'Pending',
    assigned: 'Assigned to driver',
    picked_up: 'Picked up',
    in_transit: 'In transit',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    failed: 'Delivery failed',
    cancelled: 'Cancelled',
  };

  const label = statusLabels[status] || status.replace(/_/g, ' ');
  const message = `Auradime: Your delivery ${trackingCode} is now ${label}. Track: auradime.com`;

  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendShipmentStatusSMS,
};
