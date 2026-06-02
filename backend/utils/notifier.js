const webPush = require('web-push');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const { 
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, EMAIL_USER 
} = require('../config/env');
const { sendEmail: dispatchEmail } = require('./emailService');

// ── VAPID Keys Calibration ──────────────────────────────────────────────────
// These keys must match the ones in pwa-helper.js on the frontend
const VAPID_PUB  = VAPID_PUBLIC_KEY  || 'BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ';
const VAPID_PRIV = VAPID_PRIVATE_KEY || 'aQU1zExyXuDZTuBlsHmI6iQwrVCvShRCGLR7GOYOSeY';

webPush.setVapidDetails('mailto:hello@auradime.com', VAPID_PUB, VAPID_PRIV);

// ── Signal Constants ─────────────────────────────────────────────────────────
const LOGO_URL = 'https://auradime.com/logo-white.png';
const WEB_PUSH_OPTIONS = {
  TTL: 60 * 60 * 24,
  urgency: 'high',
};

// App brand colors for notifier fallback
const COLORS = {
  accent: '#f20df2',
  accentLight: '#f472b6',
  accentGlow: 'rgba(242, 13, 242, 0.12)',
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f5f8',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
};

const templates = require('./emailTemplates');

/**
 * Signal Template: Standard Order/Status Email (Updated with app colors)
 * This now uses the shared premium templates to ensure consistency.
 */
const buildOrderEmailHtml = (title, message, orderDetails, role, emailLink, qrCode, webUrl) => {
  // If we have full order details, use the premium order template
  if (orderDetails) {
    if (role === 'customer' || role === 'user') {
      const templateData = templates.orderPlaced({ 
        order: orderDetails, 
        customer: { name: orderDetails.customer_name || 'Valued Customer' },
        qrCode: qrCode || orderDetails.qrCode,
        webUrl: webUrl
      });
      return templateData.html;
    }
    
    if (role === 'logistics') {
      const templateData = templates.shipmentAssigned({ 
        order: orderDetails,
        logistics: { company_name: 'Logistics Partner' }, // Generic label, notifier will fetch contact_email
        webUrl: webUrl
      });
      return templateData.html;
    }
 
    if (role === 'vendor') {
      const templateData = templates.newOrderForVendor({ 
        order: orderDetails,
        vendor: { store_name: orderDetails.vendor_name || 'Vendor' },
        webUrl: webUrl
      });
      return templateData.html;
    }
  }
 
  // Fallback to a styled generic notification using the shared wrapper
  return templates.wrap(title, title, `
    <p>${message}</p>
    ${emailLink ? `<div style="text-align: center; margin-top: 32px;"><a href="${emailLink}" class="btn">View Details</a></div>` : ''}
  `);
};
 
const sendNotification = async (app, recipientId, data) => {
  try {
    const { 
      title, 
      message, 
      type, 
      metadata, 
      sendEmail = false, 
      emailLink = null, 
      orderDetails = null, 
      role = 'user', 
      overrideEmail = null, 
      emailTemplate = null,
      qrCode = null,
      webUrl = null,
      senderAvatar = null,   // chat: sender's avatar for richer OS notification
    } = data;

    // 1. Create DB Record (Synchronous to ensure ID exists)
    const notification = await Notification.create({
      recipient: recipientId, title, message, type, metadata
    });

    const io = app.get('io');
    // 🚀 REDUNDANCY GUARD: Chat messages already emit 'receive_message' in the controller.
    if (io && type !== 'message') {
      io.to(recipientId.toString()).emit('notification', notification);
    }

    // ─────────────────────────────────────────────
    // NON-BLOCKING BACKGROUND CHANNELS
    // ─────────────────────────────────────────────
    
    // 🚀 CHANNEL 1: PWA WEB PUSH (ULTRA-FAST PATH)
    (async () => {
      try {
        const PushSubscription = require('../models/PushSubscription.model');
        const subs = await PushSubscription.find({ user_id: recipientId });

        if (subs.length > 0) {
          const notificationUrl = metadata?.link || '/discovery';

          // Use sender avatar for chat notifications, app logo for everything else
          const iconUrl = (type === 'message' && senderAvatar)
            ? senderAvatar
            : '/logo-white.png';

          const senderId = metadata?.sender_id || metadata?.senderId;

          const payload = JSON.stringify({
            title,
            body: message,
            icon: iconUrl,
            image: (type === 'message' && senderAvatar) ? senderAvatar : undefined,
            tag: (type === 'message' && senderId) ? `msg-${senderId}` : `alert-${recipientId}-${Date.now()}`,
            data: { 
              url: notificationUrl,
              sender_id: senderId,
              senderId: senderId,
              notification_id: notification._id.toString(),
              type
            },
            sender_id: senderId,
            senderId: senderId,
            notification_id: notification._id.toString(),
            type
          });

          const results = await Promise.allSettled(subs.map(sub => 
            webPush.sendNotification(sub.subscription, payload, WEB_PUSH_OPTIONS)
              .catch(async (e) => {
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
                  await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
                  console.log(`🗑️  Purged invalid sub ${sub._id} (HTTP ${e.statusCode})`);
                }
                throw e;
              })
          ));
          const delivered = results.filter(result => result.status === 'fulfilled').length;
          const failed = results.length - delivered;
          console.log(`📱 PWA Push Signal Broadcasted to ${delivered}/${subs.length} connections for ${recipientId}${failed ? ` (${failed} failed)` : ''}`);
        } else {
          console.log(`[PWA] No saved push subscriptions for ${recipientId}; notification stored only (${type}).`);
        }
      } catch (err) {
        console.error('❌ PWA Push Signal Error:', err.message);
      }
    })();

    // 🚀 CHANNEL 2: EMAIL DISPATCH (RELIABILITY PATH)
    if (sendEmail && EMAIL_USER) {
      (async () => {
        try {
          const EmailLog = require('../models/EmailLog.model');
          const user = await User.findById(recipientId).select('email name role');
          let targetEmail = overrideEmail || user?.email;

          if (role === 'logistics' && !overrideEmail) {
            const LogisticsCompany = require('../models/LogisticsCompany.model');
            const firm = await LogisticsCompany.findOne({ user_id: recipientId }).select('contact_email');
            if (firm?.contact_email) targetEmail = firm.contact_email;
          }
          
          if (targetEmail) {
            const success = await dispatchEmail({
              to: targetEmail,
              subject: title,
              text: message,
              html: emailTemplate?.html || buildOrderEmailHtml(title, message, orderDetails, role, emailLink, qrCode, webUrl),
              role: role || 'user'
            });

            if (success) {
              await EmailLog.create({
                recipient_email: targetEmail,
                recipient_user_id: recipientId,
                subject: title || 'Auradime Signal',
                message_preview: message ? message.substring(0, 100) : '',
                role: role || 'user',
                status: 'sent'
              });
              console.log(`📧 Email Signal Delivered via Shared Service to ${targetEmail}`);
            }
          }
        } catch (err) {
          console.error('❌ Email Signal Dispatch Error:', err.message);
        }
      })();
    }

    return notification;
  } catch (err) {
    console.error('❌ Auradime Dispatch Fail:', err);
  }
};

const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    await Promise.allSettled(followers.map(f => sendNotification(app, f.user_id, { ...data, type: 'vendor_update' })));
  } catch (err) {
    console.error('Follower broadcast fail:', err);
  }
};

module.exports = { sendNotification, notifyFollowers };
