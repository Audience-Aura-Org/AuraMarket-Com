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
  EMAIL_REPLY_TO,
  RESEND_API_KEY,
} = require('../config/env');

// Sender shown to recipients. EMAIL_FROM may be a bare address (noreply@auradime.com)
// or already formatted ("Auradime" <noreply@auradime.com>). With Titan SMTP it must be
// the login mailbox or one of its aliases, otherwise Titan rejects the message.
const SENDER_ADDRESS = EMAIL_FROM || EMAIL_USER || 'hello@auradime.com';
const FROM_HEADER = SENDER_ADDRESS.includes('<')
  ? SENDER_ADDRESS
  : `"${EMAIL_FROM_NAME || 'Aura Dime'}" <${SENDER_ADDRESS}>`;
const BARE_SENDER = (SENDER_ADDRESS.match(/<([^>]+)>/) || [null, SENDER_ADDRESS])[1].trim();
const BRAND_NAME = (EMAIL_FROM_NAME || 'Auradime').replace(/"/g, '');
// "Auradime Security" <noreply@…> for a verification code, "Auradime Deposits" for a deposit…
const fromFor = (label, address = BARE_SENDER) => (label ? `"${BRAND_NAME} ${label}" <${address}>` : FROM_HEADER.includes('<') && address === BARE_SENDER ? FROM_HEADER : `"${BRAND_NAME}" <${address}>`);
// Replies to a no-reply sender should still reach a monitored inbox.
const DEFAULT_REPLY_TO = EMAIL_REPLY_TO || EMAIL_USER || undefined;

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
// Fragments (e.g. "<p>Your code is …</p>") get the branded layout so every email looks the same.
const brandHtml = (html, subject) => {
  if (!html || /^\s*(<!doctype|<html)/i.test(html)) return html;
  const { wrap, escapeHtml } = require('./emailTemplates');
  const heading = escapeHtml(String(subject || 'Auradime').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Auradime');
  return wrap(heading, heading, html);
};

const sendEmail = async ({ to, subject, html: rawHtml, text, replyTo, category }) => {
  const { emailCategory, preheaderHtml } = require('./emailTemplates');
  const label = emailCategory({ category, subject });
  let html = brandHtml(rawHtml, subject);
  if (html) {
    // Inbox / notification preview: the email's own message, not the header text.
    html = html.replace('<!--AURA_PREHEADER-->', preheaderHtml(text || subject));
    // Header line under the logo says what the email is about.
    if (label) html = html.replace('Commerce &bull; logistics &bull; fulfilment', label);
  }
  const FROM = fromFor(label);
  if (RESEND_API_KEY) {
    try {
      const response = await fetchWithTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || subject,
          reply_to: replyTo || DEFAULT_REPLY_TO,
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

  const message = {
    from:    FROM,
    to:      Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    text:    text || subject,
    replyTo: replyTo || DEFAULT_REPLY_TO,
  };
  try {
    let info;
    try {
      info = await transporter.sendMail(message);
    } catch (err) {
      // Titan answers 553 "Sender address rejected: not owned by user" when EMAIL_FROM is
      // not an alias of the login mailbox. Deliver from the login mailbox rather than drop it.
      if (err.responseCode !== 553 || !EMAIL_USER || SENDER_ADDRESS.includes(EMAIL_USER)) throw err;
      console.error(`⚠️  Sender ${SENDER_ADDRESS} rejected by SMTP; add it as an alias of ${EMAIL_USER}. Retrying from ${EMAIL_USER}.`);
      info = await transporter.sendMail({ ...message, from: fromFor(label, EMAIL_USER) });
    }

    console.log(`📧 Email sent → ${to} | Subject: "${subject}" | MsgId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed → ${to} | ${err.message}`);
    return false;
  }
};

module.exports = { sendEmail, verifyConnection };
