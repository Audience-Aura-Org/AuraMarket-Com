const Notification = require('../models/Notification.model');
const User = require('../models/User.model');
const nodemailer = require('nodemailer');
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = require('../config/env');

/**
 * utils/notifier.js
 * Centralized utility for sending persistent, real-time, and email notifications.
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
    rejectUnauthorized: false  // Required for Titan SMTP
  }
});

// Verify transport on startup (non-blocking)
transporter.verify((err) => {
  if (err) {
    console.warn('⚠️  SMTP transport verification failed:', err.message);
  } else {
    console.log('✅ SMTP transport ready — connected to', EMAIL_HOST);
  }
});

/**
 * Build a clean, branded HTML email body
 */
const buildEmailHtml = (title, message, link = null) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#111;border-radius:24px 24px 0 0;padding:32px 40px;text-align:center;border-bottom:1px solid #222;">
              <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#fff;">
                Aura<span style="color:#a855f7;">Market</span>
              </h1>
              <p style="margin:6px 0 0;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:3px;">Notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#111;padding:40px;border-bottom:1px solid #222;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${title}</h2>
              <p style="margin:0 0 32px;font-size:14px;color:#888;line-height:1.7;">${message}</p>
              ${link ? `
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#a855f7;border-radius:12px;padding:0;">
                    <a href="${link}" style="display:inline-block;padding:14px 28px;font-size:11px;font-weight:800;color:#fff;text-decoration:none;text-transform:uppercase;letter-spacing:2px;">View Details</a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d0d;border-radius:0 0 24px 24px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#444;line-height:1.6;">
                You received this because you have an account at <strong style="color:#666;">AuraMarket</strong>.<br>
                &copy; ${new Date().getFullYear()} Audience Aura · <a href="mailto:info@audienceaura.org" style="color:#a855f7;text-decoration:none;">info@audienceaura.org</a>
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

/**
 * sendNotification
 * @param {Object} app  - Express app instance (for io access)
 * @param {String} recipientId - MongoDB User ObjectId
 * @param {Object} data - { title, message, type, metadata, sendEmail }
 */
const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false, emailLink = null } = data;

    // 1. Persist to DB
    const notification = await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
      metadata
    });

    // 2. Emit via Socket.IO if user is online
    const io = app.get('io');
    if (io) {
      io.to(recipientId.toString()).emit('notification', notification);
    }

    // 3. Send Email if requested and SMTP is configured
    if (sendEmail && EMAIL_USER) {
      try {
        const user = await User.findById(recipientId).select('email name');
        if (user?.email) {
          await transporter.sendMail({
            from: `"Aura Market" <${EMAIL_USER}>`,
            to: user.email,
            subject: title,
            text: message,
            html: buildEmailHtml(title, message, emailLink)
          });
          console.log(`📧 Email sent to ${user.email}: ${title}`);
        }
      } catch (emailErr) {
        // Log email error but don't crash the notification flow
        console.error('📧 Email send failed (non-fatal):', emailErr.message);
      }
    }

    return notification;
  } catch (error) {
    console.error('Notification Dispatch Error:', error);
  }
};

/**
 * notifyFollowers
 * Sends a notification to all followers of a vendor.
 */
const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    
    if (followers.length === 0) return;

    const promises = followers.map(f => sendNotification(app, f.user_id, {
      ...data,
      type: 'vendor_update'
    }));

    await Promise.all(promises);
  } catch (error) {
    console.error('Mass Notification Error:', error);
  }
};

module.exports = { sendNotification, notifyFollowers };
