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
  // Safely map products - handle both direct product array and nested products
  const productList = (orderDetails?.products || []).map(p => {
    const productName = p.name || p.product?.name || 'Product';
    const productQty = p.quantity || 1;
    return `<li style="margin-bottom: 8px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; color: #333;">${productName} <span style="color: #888; font-weight: 500;">×${productQty}</span></li>`;
  }).join('');
  
  const totalAmount = orderDetails?.total_amount || 0;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div style="font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); border: 1px solid rgba(233,69,96,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #e94560 0%, #d4365a 100%); padding: 40px 30px; color: white; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; transform: translate(100px, -50px);"></div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; position: relative; z-index: 1; font-family: 'Poppins', sans-serif;">${title}</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; color: #333; margin-bottom: 20px; line-height: 1.8; font-family: 'Poppins', sans-serif;">${message}</p>
      
      ${orderDetails ? `
        <div style="background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%); border: 1.5px solid #e8e8e8; padding: 24px; border-radius: 10px; margin: 24px 0;">
          <h3 style="margin-top: 0; margin-bottom: 16px; color: #1d1d1f; font-weight: 800; font-family: 'Poppins', sans-serif;">Order Details</h3>
          <ul style="padding-left: 0; list-style: none; margin: 0 0 16px 0;">${productList}</ul>
          <div style="border-top: 1.5px solid #f0f0f0; padding-top: 16px; margin-top: 16px;">
            <p style="margin: 0; display: flex; justify-content: space-between; font-weight: 700; color: #1d1d1f; font-size: 16px; font-family: 'Poppins', sans-serif; align-items: center;">
              <span>Total:</span>
              <span style="color: #e94560; font-size: 18px;">XAF ${totalAmount.toLocaleString()}</span>
            </p>
          </div>
        </div>
      ` : ''}
      
      ${emailLink ? `
        <div style="margin-top: 30px; text-align: center;">
          <a href="${emailLink}" style="display: inline-block; background: linear-gradient(135deg, #e94560 0%, #d4365a 100%); color: #fff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; font-family: 'Poppins', sans-serif; box-shadow: 0 4px 12px rgba(233,69,96,0.3);">View Details on Aura</a>
        </div>
      ` : ''}
    </div>
    
    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #f5f5f7 0%, #fafafa 100%); padding: 24px 30px; text-align: center; border-top: 1.5px solid #e8e8e8;">
      <p style="margin: 0; font-size: 12px; color: #888; font-family: 'Poppins', sans-serif;">Aura Market Protocol — Secure Transaction Channel</p>
    </div>
  </div>
</body>
</html>
  `;
};

const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false, emailLink = null, orderDetails = null, role = 'user', overrideEmail = null, emailTemplate = null } = data;

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
          // Use relative URLs for PWA notifications so they open correctly in the app context
          // This fixes the issue where PWA notifications were opening in localhost instead of production
          const notificationUrl = metadata?.link || '/discovery';
          const payload = JSON.stringify({
            title,
            body: message,
            icon: '/logo-white.png', 
            tag: type === 'message' ? `msg-${recipientId}` : `alert-${recipientId}-${Date.now()}`,
            data: { url: notificationUrl }
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
              html: emailTemplate?.html || buildOrderEmailHtml(title, message, orderDetails, role, emailLink)
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
