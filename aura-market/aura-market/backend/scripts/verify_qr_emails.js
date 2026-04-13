/**
 * scripts/verify_qr_emails.js
 * Verification script for styled email templates with QR codes
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const qrcode = require('qrcode');
const { orderPlaced, orderStatusUpdated } = require('../utils/emailTemplates');
const { sendEmail } = require('../utils/emailService');

const TEST_EMAIL = process.argv[2] || 'brandonasah11@gmail.com';

async function verify() {
  console.log('🚀 Starting Email Layout Verification...');
  console.log(`📧 Target Email: ${TEST_EMAIL}`);

  const mockOrder = {
    _id: '6617ab5c2d3e4f5a6b7c8d9e',
    total_amount: 125500,
    payment_method: 'wallet',
    order_status: 'processing',
    products: [
      { name: 'Aura Premium Watch', price: 85000, quantity: 1 },
      { name: 'Leather Strap', price: 15000, quantity: 2 },
      { name: 'Screen Protector', price: 5000, quantity: 1 }
    ],
    createdAt: new Date()
  };

  const mockCustomer = {
    name: 'Brandon Asah',
    email: TEST_EMAIL
  };

  try {
    const trackingLink = `${process.env.WEB_CLIENT_URL || 'https://aura-market-com.vercel.app'}/orders/${mockOrder._id}`;
    const qrCodeDataUrl = await qrcode.toDataURL(trackingLink);

    console.log('🛠️ Generating Order Placed template...');
    const template1 = orderPlaced({ 
      order: mockOrder, 
      customer: mockCustomer, 
      qrCode: qrCodeDataUrl 
    });

    console.log('📤 Sending Order Placed verification email...');
    await sendEmail({
      to: TEST_EMAIL,
      subject: template1.subject,
      html: template1.html,
      text: template1.text
    });

    console.log('🛠️ Generating Order Status Update template...');
    const template2 = orderStatusUpdated({ 
      order: { ...mockOrder, order_status: 'shipped' }, 
      customer: mockCustomer, 
      qrCode: qrCodeDataUrl 
    });

    console.log('📤 Sending Status Update verification email...');
    await sendEmail({
      to: TEST_EMAIL,
      subject: template2.subject,
      html: template2.html,
      text: template2.text
    });

    console.log('\n✅ Verification emails sent! Please check your inbox.');
    console.log(`🔗 Scanning the QR code should point to: ${trackingLink}`);
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  }
}

verify();
