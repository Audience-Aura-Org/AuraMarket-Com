const webPush = require('web-push');
const nodemailer = require('nodemailer');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const { 
  EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, 
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY 
} = require('../config/env');

// ── VAPID Keys Calibration ──────────────────────────────────────────────────
// These keys must match the ones in pwa-helper.js on the frontend
const VAPID_PUB  = VAPID_PUBLIC_KEY  || 'BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ';
const VAPID_PRIV = VAPID_PRIVATE_KEY || 'aQU1zExyXuDZTuBlsHmI6iQwrVCvShRCGLR7GOYOSeY';

webPush.setVapidDetails('mailto:info@audienceaura.org', VAPID_PUB, VAPID_PRIV);

// ── SMTP Transporter for Signals ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT == 465, // true for 465, false for 587 (STARTTLS)
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  tls: { rejectUnauthorized: false } // Crucial for Titan SMTP stability on cloud nodes
});

/**
 * Signal Template: Standard Order/Status Email
 */
const buildOrderEmailHtml = (title, message, orderDetails, role, emailLink) => {
  const items = orderDetails?.products?.map(p => `<li>${p.name} x ${p.quantity}</li>`).join('') || '';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
      <h1 style="color: #0a0a0a; border-bottom: 2px solid #0a0a0a; padding-bottom: 10px;">${title}</h1>
      <p style="font-size: 16px; color: #333;">${message}</p>
      ${orderDetails ? `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Details</h3>
          <ul style="padding-left: 20px;">${items}</ul>
          <p><strong>Total:</strong> ${orderDetails.total_amount?.toLocaleString()} XAF</p>
        </div>
      ` : ''}
      ${emailLink ? `
        <div style="margin-top: 30px; text-align: center;">
          <a href="${emailLink}" style="background: #0a0a0a; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Details on Aura</a>
        </div>
      ` : ''}
      <p style="margin-top: 40px; font-size: 12px; color: #999; text-align: center;">Aura Market Protocol — Secure Transaction Channel</p>
    </div>
  `;
};

const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false, emailLink = null, orderDetails = null, role = 'user', overrideEmail = null } = data;

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
          const payload = JSON.stringify({
            title,
            body: message,
            icon: '/logo-white.png', 
            tag: type === 'message' ? `msg-${recipientId}` : `alert-${recipientId}-${Date.now()}`,
            data: { url: emailLink || (metadata?.link) || '/discovery' }
          });

          await Promise.allSettled(subs.map(sub => 
            webPush.sendNotification(sub.subscription, payload)
              .catch(async (e) => {
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
                  await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
                  console.log(`🗑️  Purged invalid sub ${sub._id} (HTTP ${e.statusCode})`);
                }
              })
          ));
          console.log(`📱 PWA Push Signal Broadcasted to ${subs.length} connections for ${recipientId}`);
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
            const info = await transporter.sendMail({
              from: `"Aura Market" <${EMAIL_USER}>`,
              to: targetEmail,
              subject: title,
              text: message,
              html: buildOrderEmailHtml(title, message, orderDetails, role, emailLink)
            });

            await EmailLog.create({
              recipient_email: targetEmail,
              recipient_user_id: recipientId,
              subject: title || 'Aura Signal',
              message_preview: message ? message.substring(0, 100) : '',
              role: role || 'user',
              status: 'sent',
              message_id: info.messageId
            });
            console.log(`📧 Email Signal Delivered via SMTP: ${info.messageId}`);
          }
        } catch (err) {
          console.error('❌ Email Signal Dispatch Error:', err.message);
        }
      })();
    }

    return notification;
  } catch (err) {
    console.error('❌ Aura Dispatch Fail:', err);
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
