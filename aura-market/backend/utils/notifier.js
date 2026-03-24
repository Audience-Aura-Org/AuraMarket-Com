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
  }
});

const sendNotification = async (app, recipientId, data) => {
  try {
    const { title, message, type, metadata, sendEmail = false } = data;

    // 1. Save to Database for persistence
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

    // 3. Optional Email Notification
    if (sendEmail && EMAIL_USER) {
      const user = await User.findById(recipientId);
      if (user && user.email) {
        await transporter.sendMail({
          from: `"Aura Market" <${EMAIL_USER}>`,
          to: user.email,
          subject: title,
          text: message,
          html: `<p>${message}</p>`
        });
      }
    }

    return notification;
  } catch (error) {
    console.error('Notification Dispatch Error:', error);
  }
};

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
