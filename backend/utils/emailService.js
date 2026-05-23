/**
 * utils/emailService.js
 * Aura Market — Dedicated Email Service (Titan SMTP)
 *
 * Wraps nodemailer with Titan SMTP credentials.
 * All email-sending across the system should go through sendEmail().
 */

const nodemailer = require('nodemailer');
const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM_NAME,
} = require('../config/env');

/* ── Build the reusable transporter once ── */
const transporter = nodemailer.createTransport({
  host:   EMAIL_HOST   || 'smtp.titan.email',
  port:   EMAIL_PORT   || 587,
  secure: EMAIL_SECURE || false,          // false → STARTTLS; true → TLS/465
  auth: {
    user: EMAIL_USER || 'hello@auradime.com',
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,            // Titan may use self-signed on dev
  },
});

/**
 * Verify SMTP connection on startup (logs, never throws)
 */
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Titan SMTP connection verified — emails ready.');
  } catch (err) {
    console.warn('⚠️  Titan SMTP connection failed:', err.message);
  }
};

/**
 * Send an email.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to      - Recipient address(es)
 * @param {string}          opts.subject - Email subject
 * @param {string}          opts.html    - HTML body
 * @param {string}          [opts.text]  - Plain-text fallback
 * @param {string}          [opts.replyTo] - Reply-To address
 * @returns {Promise<boolean>}           - true on success, false on failure
 */
const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  if (!EMAIL_PASS) {
    console.warn('⚠️  EMAIL_PASS not set — skipping email send.');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from:    `"${EMAIL_FROM_NAME || 'Auradime'}" <${EMAIL_USER}>`,
      to:      Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text:    text || subject,
      replyTo: replyTo || EMAIL_USER,
    });

    console.log(`📧 Email sent → ${to} | Subject: "${subject}" | MsgId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed → ${to} | ${err.message}`);
    return false;
  }
};

module.exports = { sendEmail, verifyConnection };
