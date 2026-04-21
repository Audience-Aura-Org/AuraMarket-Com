/**
 * scripts/check_email_logs.js
 * Check email logs and SMTP connectivity
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aura_market';

async function checkEmailLogs() {
  try {
    console.log('📧 Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check SMTP configuration
    console.log('🔧 SMTP Configuration:');
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${process.env.EMAIL_PORT}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   Secure: ${process.env.EMAIL_PORT == 465}`);

    // Test SMTP connection
    console.log('\n🔌 Testing SMTP Connection...');
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false }
    });

    try {
      await transporter.verify();
      console.log('✅ SMTP Connection Verified - Ready to send emails\n');
    } catch (err) {
      console.error('❌ SMTP Connection Failed:', err.message, '\n');
    }

    // Check email logs
    console.log('📋 Checking Email Logs...\n');
    const EmailLog = require('../models/EmailLog.model');
    const recentEmails = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(10);

    if (recentEmails.length === 0) {
      console.log('⚠️  No email logs found in database');
    } else {
      console.log(`Found ${recentEmails.length} recent emails:\n`);
      recentEmails.forEach((log, idx) => {
        console.log(`${idx + 1}. To: ${log.recipient_email}`);
        console.log(`   Subject: ${log.subject}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Sent: ${log.createdAt.toLocaleString()}`);
        console.log(`   Message ID: ${log.message_id || 'N/A'}`);
        console.log('');
      });
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
}

checkEmailLogs();
