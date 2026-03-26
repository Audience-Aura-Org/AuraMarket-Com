const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const nodemailer = require('nodemailer');
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = require('../config/env');

/**
 * utils/notifier.js
 */

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT == 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((err) => {
  if (err) console.warn('⚠️ SMTP failed:', err.message);
  else console.log('✅ SMTP ready');
});

/**
 * Build a structured, role-specific HTML order email
 */
const buildOrderEmailHtml = (title, message, order = null, role = 'user', link = null) => {
  let detailsHtml = '';

  if (order) {
    const items = (order.products || []).map(p => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #222;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">${p.name}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#555;">QTY: ${p.quantity} · ${p.price.toLocaleString()} XAF</p>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #222;text-align:right;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#a855f7;font-family:monospace;">${(p.price * p.quantity).toLocaleString()}</p>
        </td>
      </tr>
    `).join('');

    const shipping = order.shipping_address || {};
    const deliveryNode = `
      <div style="background:#0d0d0d;border:1px solid #222;border-radius:16px;padding:24px;margin-top:32px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:900;color:#555;text-transform:uppercase;letter-spacing:2px;">Target Coordinates</p>
        <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">${shipping.name || 'Recipient'}</p>
        <p style="margin:4px 0;font-size:12px;color:#888;">${shipping.quartier || ''}${shipping.street ? ', ' + shipping.street : ''}</p>
        <p style="margin:0;font-size:11px;font-weight:900;color:#a855f7;">${shipping.phone || ''}</p>
      </div>
    `;

    detailsHtml = `
      <div style="margin-top:32px;border-top:2px solid #222;padding-top:32px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:900;color:#555;text-transform:uppercase;letter-spacing:2px;">Protocol Manifest</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr>
            <td style="font-size:13px;font-weight:900;color:#fff;text-transform:uppercase;">Grand Total</td>
            <td style="font-size:18px;font-weight:900;color:#fff;text-align:right;font-family:monospace;">${(order.total_amount || 0).toLocaleString()} <span style="font-size:10px;color:#555;">XAF</span></td>
          </tr>
        </table>

        ${(role === 'vendor' || role === 'logistics') ? deliveryNode : ''}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#111;border-radius:32px;border:1px solid #222;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:40px;text-align:center;border-bottom:1px solid #222;">
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px;">Aura<span style="color:#a855f7;">Market</span></h1>
          <div style="display:inline-block;margin-top:12px;padding:6px 12px;background:#a855f7/10;border:1px solid #a855f7/20;border-radius:100px;">
            <p style="margin:0;font-size:9px;font-weight:900;color:#a855f7;text-transform:uppercase;letter-spacing:2px;">Secure Protocol Verified</p>
          </div>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.2;">${title}</h2>
          <p style="margin:0;font-size:15px;color:#888;line-height:1.6;">${message}</p>
          
          ${detailsHtml}

          ${link ? `
          <div style="margin-top:40px;text-align:center;">
            <a href="${link}" style="display:inline-block;padding:18px 36px;background:#fff;color:#000;text-decoration:none;border-radius:18px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;box-shadow:0 10px 20px rgba(0,0,0,0.4);">Access Manifest</a>
          </div>
          ` : ''}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:32px 40px;background:#0d0d0d;text-align:center;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:11px;color:#444;line-height:1.8;">
            Transaction Hash: [${Math.random().toString(36).slice(2, 10).toUpperCase()}]<br>
            © ${new Date().getFullYear()} Audience Aura — Decentralized Commerce
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;
};

const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false, emailLink = null, orderDetails = null, role = 'user' } = data;

    const notification = await Notification.create({
      recipient: recipientId, title, message, type, metadata
    });

    const io = app.get('io');
    if (io) io.to(recipientId.toString()).emit('notification', notification);

    if (sendEmail && EMAIL_USER) {
      try {
        const user = await User.findById(recipientId).select('email name');
        if (user?.email) {
          await transporter.sendMail({
            from: `"Aura Market" <${EMAIL_USER}>`,
            to: user.email,
            subject: title,
            text: message,
            html: buildOrderEmailHtml(title, message, orderDetails, role, emailLink)
          });
        }
      } catch (e) { console.error('📧 Email error:', e.message); }
    }
    return notification;
  } catch (err) { console.error('Dispatch error:', err); }
};

const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    await Promise.all(followers.map(f => sendNotification(app, f.user_id, { ...data, type: 'vendor_update' })));
  } catch (err) { console.error('Follower notify error:', err); }
};

module.exports = { sendNotification, notifyFollowers };
