/**
 * scripts/direct_email_test.js
 * Direct test to send email using the email templates with app colors
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const {
  EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_NAME
} = process.env;

const TEST_EMAIL = process.argv[2] || 'brandonasah11@gmail.com';

// Import the actual email templates
const {
  orderPlaced
} = require('../utils/emailTemplates');

async function testEmail() {
  console.log('📧 Testing Auradime Email Templates...\n');
  console.log('SMTP Config:');
  console.log(`  Host: ${EMAIL_HOST}`);
  console.log(`  Port: ${EMAIL_PORT}`);
  console.log(`  From: ${EMAIL_FROM_NAME || 'Auradime'}`);
  console.log(`  To: ${TEST_EMAIL}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT == 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: { rejectUnauthorized: false }
  });

  // Mock order data (same as what would be sent in real notifications)
  const mockOrder = {
    _id: new mongoose.Types.ObjectId(),
    total_amount: 75000,
    payment_method: 'pay_on_delivery',
    products: [
      { name: 'Premium Wireless Headphones', price: 45000, quantity: 1 },
      { name: 'Phone Case', price: 8000, quantity: 2 },
      { name: 'Screen Protector', price: 4000, quantity: 3 }
    ]
  };

  const mockCustomer = {
    name: 'Brandon Asah',
    email: TEST_EMAIL
  };

  try {
    console.log('🔄 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Generate email using the actual template
    const emailData = orderPlaced({ order: mockOrder, customer: mockCustomer });

    console.log('📤 Sending order confirmation email...');
    console.log(`   Subject: ${emailData.subject}`);
    
    const info = await transporter.sendMail({
      from: `"${EMAIL_FROM_NAME || 'Aura Dime'}" <${EMAIL_USER}>`,
      to: TEST_EMAIL,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    });

    console.log('✅ Email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📬 Response: ${info.response}`);
    console.log(`\n⏱️  Check your inbox at ${TEST_EMAIL}`);
    console.log('   (May take a few moments to arrive, check spam folder too)\n');
    console.log('📋 Email Preview:');
    console.log('   - Gradient magenta header with Auradime logo');
    console.log('   - Order details card with product list');
    console.log('   - Magenta CTA button');
    console.log('   - Professional footer');

  } catch (err) {
    console.error('❌ Email sending failed:');
    console.error('   Error:', err.message);
    console.error('   Code:', err.code);
    if (err.response) console.error('   Response:', err.response);
  }
}

testEmail();
