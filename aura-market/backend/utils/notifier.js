/**
 * utils/notifier.js
 * Aura Market — Centralized Notification Dispatcher
 *
 * Handles:
 *  1. Persistent DB notifications (Notification model)
 *  2. Real-time Socket.IO push (if user is online)
 *  3. Email delivery via emailService (Titan SMTP)
 */

const Notification = require('../models/Notification.model');
const User          = require('../models/User.model');
const { sendEmail } = require('./emailService');

/**
 * Send a notification to a single user.
 *
 * @param {object}  app         - Express app instance (for Socket.IO access)
 * @param {string}  recipientId - MongoDB User _id
 * @param {object}  data
 * @param {string}  data.title
 * @param {string}  data.message
 * @param {string}  data.type
 * @param {object}  [data.metadata]
 * @param {boolean} [data.sendEmail=false]     - Send plain-text email using title/message
 * @param {object}  [data.emailTemplate]       - { subject, html, text } — overrides plain email
 */
const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail: wantsEmail = false, emailTemplate } = data;

    // 1. Persist notification
    const notification = await Notification.create({
      recipient: recipientId,
      title,
      message,
      type,
      metadata,
    });

    // 2. Real-time push via Socket.IO
    const io = app?.get('io');
    if (io) {
      io.to(recipientId.toString()).emit('notification', notification);
    }

    // 3. Email delivery
    if (wantsEmail || emailTemplate) {
      const user = await User.findById(recipientId).select('email name');
      if (user?.email) {
        if (emailTemplate) {
          // Rich HTML template provided by caller
          await sendEmail({
            to:      user.email,
            subject: emailTemplate.subject,
            html:    emailTemplate.html,
            text:    emailTemplate.text,
          });
        } else {
          // Fallback: plain-text email
          await sendEmail({
            to:      user.email,
            subject: title,
            html:    `<p>${message}</p>`,
            text:    message,
          });
        }
      }
    }

    return notification;
  } catch (error) {
    console.error('Notification Dispatch Error:', error);
  }
};

/**
 * Broadcast a notification to all followers of a vendor.
 */
const notifyFollowers = async (app, vendorId, data) => {
  try {
    const Follow = require('../models/Follow.model');
    const followers = await Follow.find({ vendor_id: vendorId });
    if (followers.length === 0) return;

    await Promise.all(
      followers.map(f => sendNotification(app, f.user_id, { ...data, type: 'vendor_update' }))
    );
  } catch (error) {
    console.error('Mass Notification Error:', error);
  }
};

module.exports = { sendNotification, notifyFollowers };
