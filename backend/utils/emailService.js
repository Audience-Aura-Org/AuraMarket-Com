/**
 * utils/emailService.js
 * Auradime — Dedicated Email Service (Resend first, SMTP fallback)
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
  EMAIL_FROM,
  RESEND_API_KEY,
} = require('../config/env');

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 15000);

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
  connectionTimeout: EMAIL_TIMEOUT_MS,
  greetingTimeout: EMAIL_TIMEOUT_MS,
  socketTimeout: EMAIL_TIMEOUT_MS,
});

const fetchWithTimeout = async (url, options = {}, timeoutMs = EMAIL_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Email provider timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Verify SMTP connection on startup (logs, never throws)
 */
const verifyConnection = async () => {
  if (RESEND_API_KEY) {
    console.log('✅ Resend email provider configured — emails ready.');
    return;
  }

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
  if (RESEND_API_KEY) {
    try {
      const response = await fetchWithTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM || `"${EMAIL_FROM_NAME || 'Aura Dime'}" <${EMAIL_USER || 'hello@auradime.com'}>`,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || subject,
          reply_to: replyTo || EMAIL_USER || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend ${response.status}: ${body}`);
      }

      console.log(`📧 Email sent via Resend → ${to} | Subject: "${subject}"`);
      return true;
    } catch (err) {
      console.error(`❌ Resend email failed → ${to} | ${err.message}`);
      return false;
    }
  }

  if (!EMAIL_PASS) {
    console.warn('⚠️  EMAIL_PASS not set — skipping email send.');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from:    `"${EMAIL_FROM_NAME || 'Aura Dime'}" <${EMAIL_USER}>`,
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
