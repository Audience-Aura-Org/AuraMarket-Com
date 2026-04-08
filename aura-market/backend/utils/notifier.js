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

const LOGO_URL = 'https://aura-market-com.vercel.app/logo-white.png';

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

/**
 * Signal Template: Standard Order/Status Email (Updated with app colors)
 */
const buildOrderEmailHtml = (title, message, orderDetails, role, emailLink) => {
  // Safely map products - handle both direct product array and nested products
  const productList = (orderDetails?.products || []).map(p => {
    const productName = p.name || p.product?.name || 'Product';
    const productQty = p.quantity || 1;
    return `<li style="margin-bottom: 10px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; color: ${COLORS.textSecondary}; border-bottom: 1px solid ${COLORS.accentGlow}; padding-bottom: 10px;">${productName} <span style="color: ${COLORS.textSecondary}; font-weight: 500;">×${productQty}</span></li>`;
  }).join('');
  
  const totalAmount = orderDetails?.total_amount || 0;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: ${COLORS.accentGlow}; }
    .email-wrapper { width: 100%; background: linear-gradient(180deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); padding: 40px 16px; }
    .email-container { max-width: 600px; width: 100%; margin: 0 auto; background: ${COLORS.bgPrimary}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); padding: 24px 32px; text-align: center; position: relative; }
    .header::before { content: ''; position: absolute; top: -30%; right: -10%; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; }
    .header-content { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 12px; }
    .header-logo { height: 36px; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; font-family: 'Poppins', sans-serif; }
    .content { padding: 40px 32px; font-family: 'Poppins', sans-serif; }
    .content h2 { font-size: 24px; color: ${COLORS.textPrimary}; margin-bottom: 20px; font-weight: 800; font-family: 'Poppins', sans-serif; }
    .content p { font-size: 15px; color: ${COLORS.textSecondary}; margin-bottom: 16px; line-height: 1.7; font-family: 'Poppins', sans-serif; }
    .card { background: ${COLORS.bgPrimary}; border: 1px solid ${COLORS.accentGlow}; border-radius: 16px; padding: 24px; margin: 24px 0; box-shadow: 0 4px 20px rgba(242,13,242,0.08); }
    .card h3 { margin-top: 0; margin-bottom: 16px; color: ${COLORS.textPrimary}; font-weight: 800; font-family: 'Poppins', sans-serif; }
    .card ul { padding-left: 0; list-style: none; margin: 0 0 16px 0; }
    .card-total { display: flex; justify-content: space-between; font-weight: 700; color: ${COLORS.textPrimary}; font-size: 16px; font-family: 'Poppins', sans-serif; align-items: center; border-top: 1px solid ${COLORS.accentGlow}; padding-top: 16px; margin-top: 16px; }
    .card-total-amount { color: ${COLORS.accent}; font-size: 18px; }
    .btn { display: inline-block; background: linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); color: #fff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Poppins', sans-serif; box-shadow: 0 4px 20px rgba(242,13,242,0.3); }
    .footer { background: ${COLORS.textPrimary}; padding: 32px; text-align: center; font-family: 'Poppins', sans-serif; }
    .footer p { font-size: 13px; color: rgba(255,255,255,0.7); margin: 6px 0; font-family: 'Poppins', sans-serif; }
    .footer-brand { font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 8px !important; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="header-content">
          <img src="${LOGO_URL}" alt="Aura Market" class="header-logo" onerror="this.style.display='none'" />
          <h1 class="header-title">Aura Market</h1>
        </div>
      </div>
      
      <div class="content">
        <h2>${title}</h2>
        <p>${message}</p>
        
        ${orderDetails ? `
          <div class="card">
            <h3>Order Details</h3>
            <ul>${productList}</ul>
            <div class="card-total">
              <span>Total:</span>
              <span class="card-total-amount">XAF ${totalAmount.toLocaleString()}</span>
            </div>
          </div>
        ` : ''}
        
        ${emailLink ? `
          <div style="text-align: center; margin-top: 24px;">
            <a href="${emailLink}" class="btn">View Details</a>
          </div>
        ` : ''}
      </div>
      
      <div class="footer">
        <p class="footer-brand">Aura Market</p>
        <p>Questions? <a href="mailto:support@auramarket.com" style="color: ${COLORS.accentLight}; text-decoration: none; font-weight: 700;">support@auramarket.com</a></p>
        <p>© ${new Date().getFullYear()} Aura Market • Audience Aura Org</p>
      </div>
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
