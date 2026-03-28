const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const nodemailer = require('nodemailer');
const { 
  EMAIL_HOST, 
  EMAIL_PORT, 
  EMAIL_USER, 
  EMAIL_PASS,
  EMAIL_SECURE 
} = require('../config/env');
const webPush = require('web-push');

/**
 * utils/notifier.js
 */

// If explicit EMAIL_SECURE is provided, use it. Otherwise fallback to port check.
const isSecure = (EMAIL_SECURE === true || EMAIL_SECURE === 'true') ? true : (parseInt(EMAIL_PORT) === 465);

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: isSecure,
  name: 'auramarket.com', // Explicitly identify the server to avoid Titan rejection
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  },
  // ── LOGGING ──────────
  debug: false,
  logger: false,
  connectionTimeout: 15000, // Increased to 15s for STARTTLS handshake
  greetingTimeout: 15000,
});

transporter.verify((err) => {
  if (err) {
    console.warn(`⚠️  [SMTP] Link Broken [${EMAIL_HOST}:${EMAIL_PORT}]:`, err.message);
    if (err.code === 'ETIMEDOUT') {
      console.warn('👉 DIAGNOSIS: Firewall Block. Change to Port 587 and EMAIL_SECURE=false in Render dashboard.');
    }
  } else {
    console.log(`✅ [SMTP] Frequency Established: SUCCESS with ${EMAIL_HOST}:${EMAIL_PORT} (Secure: ${isSecure})`);

  }
});

// ── Initialize VAPID once at module load time (not per notification) ──────────
const VAPID_PUB  = process.env.VAPID_PUBLIC_KEY  || 'BMiW0FBPikPVXuG3v_llaQ3lgb1MfPiM_CEcKXafkGvc3KShUCR3OQkjXepzdMzaDzVxW-C8f8kBbLcTZLX9TiM';
const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY || 'bXwkKXDq6MGPtrtmBY175VsfuDHIjkXtxEvBsbAC2NM';
try {
  webPush.setVapidDetails('mailto:info@audienceaura.org', VAPID_PUB, VAPID_PRIV);
  console.log('✅ VAPID details configured for web-push');
} catch (e) {
  console.error('❌ VAPID setup failed:', e.message);
}

/**
 * Build a structured, role-specific HTML order email
 */
/**
 * Build a structured, premium, role-specific HTML order email
 */
const buildOrderEmailHtml = (title, message, order = null, role = 'user', link = null) => {
  let detailsHtml = '';

  if (order) {
    const items = (order.products || []).map(p => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 16px 0;">
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${p.name}</div>
          <div style="font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 1px;">QTY: ${p.quantity} &bull; ${p.price.toLocaleString()} XAF</div>
        </td>
        <td style="padding: 16px 0; text-align: right; vertical-align: top;">
          <div style="font-size: 14px; font-weight: 800; color: #a855f7; font-family: ui-monospace, 'Cascadia Code', monospace;">${(p.price * p.quantity).toLocaleString()}</div>
        </td>
      </tr>
    `).join('');

    const shipping = order.shipping_address || {};
    const vendorNode = order.vendor_id || {};
    const pickup = vendorNode.pickup_address || {};

    const pickupNode = `
      <div style="background: linear-gradient(145deg, #0f0f0f, #070707); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 20px; padding: 24px; margin-top: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="font-size: 9px; font-weight: 900; color: #a855f7; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Extraction Node (Vendor)</div>
        <div style="font-size: 15px; font-weight: 800; color: #ffffff;">${vendorNode.store_name || 'Verified Merchant'}</div>
        <div style="font-size: 13px; color: #888; margin-top: 4px; line-height: 1.5;">${pickup.street || ''}${pickup.quartier ? ', ' + pickup.quartier : ''}${pickup.city ? ', ' + pickup.city : ''}</div>
        <div style="font-size: 12px; font-weight: 700; color: #a855f7; margin-top: 12px; font-family: monospace;">TELECOM: ${vendorNode.phone || 'N/A'}</div>
      </div>
    `;

    const deliveryNode = `
      <div style="background: linear-gradient(145deg, #111111, #0a0a0a); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 24px; margin-top: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="font-size: 9px; font-weight: 900; color: #555; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Landing Coordinates (Client)</div>
        <div style="font-size: 15px; font-weight: 800; color: #ffffff;">${shipping.name || 'Recipient'}</div>
        <div style="font-size: 13px; color: #888; margin-top: 4px; line-height: 1.5;">${shipping.quartier || ''}${shipping.street ? ', ' + shipping.street : ''}</div>
        <div style="font-size: 12px; font-weight: 700; color: #a855f7; margin-top: 12px; font-family: monospace;">HANDSHAKE: ${shipping.phone || 'N/A'}</div>
      </div>
    `;

    detailsHtml = `
      <div style="margin-top: 40px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size: 10px; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px;">Protocol Manifest</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">${items}</table>
        
        <div style="margin-top: 32px; padding: 24px; background: rgba(168, 85, 247, 0.05); border-radius: 20px; border: 1px dashed rgba(168, 85, 247, 0.2);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 12px; font-weight: 900; color: #888; text-transform: uppercase; letter-spacing: 1px;">Contract Total</td>
              <td style="font-size: 24px; font-weight: 950; color: #ffffff; text-align: right; font-family: ui-monospace, monospace;">${(order.total_amount || 0).toLocaleString()} <span style="font-size: 12px; color: #a855f7; font-weight: 700;">XAF</span></td>
            </tr>
          </table>
        </div>

        ${(role === 'vendor' || role === 'logistics') ? pickupNode + deliveryNode : ''}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .container { padding: 20px !important; border-radius: 0 !important; }
      .header { padding: 40px 20px !important; }
      .content { padding: 40px 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" style="max-width: 600px; background-color: #0a0a0a; border-radius: 40px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 40px 100px rgba(0,0,0,0.8);" class="container">
          
          <!-- Glossy Header -->
          <tr>
            <td style="padding: 60px 40px; text-align: center; background: linear-gradient(to bottom, #111, #0a0a0a); position: relative;" class="header">
              <div style="font-size: 28px; font-weight: 950; color: #ffffff; letter-spacing: -1.5px; text-transform: uppercase; margin-bottom: 8px;">Aura<span style="color: #a855f7;">Market</span></div>
              <div style="display: inline-block; padding: 6px 16px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 100px;">
                <span style="font-size: 9px; font-weight: 900; color: #a855f7; text-transform: uppercase; letter-spacing: 2px;">SECURE PROTOCOL DISPATCH</span>
              </div>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 60px 48px;" class="content">
              <h2 style="margin: 0 0 20px; font-size: 28px; font-weight: 950; color: #ffffff; letter-spacing: -1px; line-height: 1.1;">${title}</h2>
              <p style="margin: 0; font-size: 16px; color: #888; line-height: 1.6; font-weight: 500;">${message}</p>
              
              ${detailsHtml}

              ${link ? `
              <div style="margin-top: 50px; text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 22px 48px; background-color: #ffffff; color: #000000; text-decoration: none; border-radius: 24px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 15px 35px rgba(255,255,255,0.2);">Initialize Manifest</a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer Metadata -->
          <tr>
            <td style="padding: 40px; background-color: #070707; text-align: center; border-top: 1px solid rgba(255,255,255,0.03);">
              <div style="font-size: 11px; font-weight: 700; color: #333; margin-bottom: 16px; letter-spacing: 1px;">
                SIG-ID: [${Math.random().toString(36).slice(2, 12).toUpperCase()}]
              </div>
              <p style="margin: 0; font-size: 12px; color: #555; font-weight: 600;">
                &copy; ${new Date().getFullYear()} <span style="color: #666;">Audience Aura Ecosystem</span><br>
                <span style="font-size: 10px; opacity: 0.5; margin-top: 8px; display: block;">Decentralized Commerce Protocol v2.4.1</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false, emailLink = null, orderDetails = null, role = 'user', overrideEmail = null } = data;

    const notification = await Notification.create({
      recipient: recipientId, title, message, type, metadata
    });

    const io = app.get('io');
    if (io) io.to(recipientId.toString()).emit('notification', notification);

    // ─────────────────────────────────────────────
    // BACKGROUND SIDE-EFFECTS (Non-Blocking)
    // ─────────────────────────────────────────────
    (async () => {
      // 1. EMAIL DISPATCH
      if (sendEmail && EMAIL_USER) {
        try {
          const EmailLog = require('../models/EmailLog.model');
          const user = await User.findById(recipientId).select('email name role');

          // For logistics role: always do a fresh lookup of contact_email from LogisticsCompany
          // to guarantee we use the latest corporate email, not a stale cached value
          let targetEmail = overrideEmail || user?.email;
          if (role === 'logistics') {
            const LogisticsCompany = require('../models/LogisticsCompany.model');
            const firm = await LogisticsCompany.findOne({ user_id: recipientId }).select('contact_email');
            if (firm?.contact_email) {
              targetEmail = firm.contact_email; // Always override with current DB value
            }
          }
          
          if (targetEmail) {
            console.log(`📧 Dispatching signal [${role}] to: ${targetEmail}`);
            try {
              const info = await transporter.sendMail({
                from: `"Aura Market" <${EMAIL_USER}>`,
                to: targetEmail,
                subject: title,
                text: message,
                html: buildOrderEmailHtml(title, message, orderDetails, role, emailLink)
              });

              // Log successful sending
              await EmailLog.create({
                recipient_email: targetEmail,
                recipient_user_id: recipientId,
                subject: title || 'Aura Signal',
                message_preview: message ? message.substring(0, 100) : '',
                role: role || 'user',
                status: 'sent',
                message_id: info.messageId,
                timestamp: new Date()
              });

              console.log(`✅ Dispatch successful. ID: ${info.messageId}`);
            } catch (smtpErr) {
               console.error('📧 SMTP Error Trace:', smtpErr.message);
               // Log failure
               await EmailLog.create({
                recipient_email: targetEmail,
                recipient_user_id: recipientId,
                subject: title || 'Aura Signal',
                message_preview: message ? message.substring(0, 100) : '',
                role: role || 'user',
                status: 'failed',
                error: smtpErr.message,
                timestamp: new Date()
              });
            }
          } else {
            console.warn(`⚠️  Email dispatch skipped: No email coordinate found for user ${recipientId}`);
          }
        } catch (e) {
          console.error('📧 Email background thread error:', e.message);
        }
      }

      // 2. PWA WEB PUSH — fires for ALL notifications (not just email flagged ones)
      try {
        const PushSubscription = require('../models/PushSubscription.model');

        const pwaSubscriptions = await PushSubscription.find({ user_id: recipientId });

        if (pwaSubscriptions.length > 0) {
          const payload = JSON.stringify({
            title,
            body: message,
            icon: '/logo-white.png', 
            tag: type === 'message' ? `msg-${recipientId}` : `alert-${recipientId}-${Date.now()}`,
            data: { url: emailLink || '/discovery' }
          });

          let sent = 0, failed = 0;
          await Promise.allSettled(
            pwaSubscriptions.map(async (sub) => {
              try {
                await webPush.sendNotification(sub.subscription, payload);
                sent++;
              } catch (e) {
                failed++;
                // 410 = subscription expired, 404 = endpoint gone, 401 = VAPID key mismatch
                // All three mean the subscription is permanently invalid — remove it
                if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
                  await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
                  console.log(`🗑️  Purged invalid PWA subscription ${sub._id} for user ${recipientId} (HTTP ${e.statusCode})`);
                } else {
                  console.error(`❌ PWA push failed for sub ${sub._id}: [${e.statusCode}] ${e.body || e.message}`);
                }
              }
            })
          );

          console.log(`📱 PWA Push complete for [${recipientId}]: ${sent} sent, ${failed} failed out of ${pwaSubscriptions.length} subscriptions`);
        } else {
          console.log(`📱 No PWA subscriptions found for user ${recipientId} — skipping push`);
        }
      } catch (e) {
        console.error('PWA Push background error:', e.message);
      }
    })();

    return notification;
  } catch (err) {
    console.error('Dispatch error:', err);
  }
};

const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    await Promise.all(followers.map(f => sendNotification(app, f.user_id, { ...data, type: 'vendor_update' })));
  } catch (err) { console.error('Follower notify error:', err); }
};

module.exports = { sendNotification, notifyFollowers };
