/**
 * test-email.js — Aura Market Email Width Test
 * Run from backend/: node test-email.js
 */

require('dotenv').config();
const { sendEmail } = require('./utils/emailService');
const templates = require('./utils/emailTemplates');

const run = async () => {
  const recipient = process.env.EMAIL_USER || 'info@audienceaura.org';

  // Use the welcomeEmail template as the test payload
  const tpl = templates.welcomeEmail({
    user: { name: 'Aura Admin', email: recipient, role: 'admin' },
    webUrl: process.env.WEB_CLIENT_URL || 'https://aura-market-com.vercel.app'
  });

  console.log(`📧 Sending test email to: ${recipient}`);
  const ok = await sendEmail({
    to: recipient,
    subject: `[TEST] Aura Email Width Fix — ${new Date().toLocaleTimeString()}`,
    html: tpl.html,
    text: 'This is a test email from Aura Market to verify the full-width email layout fix.'
  });

  if (ok) {
    console.log('✅ Test email sent successfully. Check your inbox.');
  } else {
    console.error('❌ Test email failed. Check SMTP credentials in .env');
  }

  process.exit(0);
};

run();
