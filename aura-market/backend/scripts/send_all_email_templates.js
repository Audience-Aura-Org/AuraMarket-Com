/**
 * scripts/send_all_email_templates.js
 * Send all email templates to test them
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const {
  EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM_NAME
} = process.env;

const TEST_EMAIL = process.argv[2] || 'brandonasah11@gmail.com';

// Import all email templates
const {
  welcomeEmail,
  passwordReset,
  orderPlaced,
  paymentConfirmed,
  shipmentStatusChanged,
  refundApproved,
  orderCompleted,
  newOrderForVendor,
  shipmentAssigned,
  refundRequested
} = require('../utils/emailTemplates');

async function sendAllEmails() {
  console.log('📧 Sending ALL Aura Market Email Templates...\n');
  console.log(`   To: ${TEST_EMAIL}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT == 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: { rejectUnauthorized: false }
  });

  // Mock data for all email types
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

  const mockShipment = {
    tracking_code: 'AURA' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    price: 2500
  };

  const mockCustomer = {
    name: 'Brandon Asah',
    email: TEST_EMAIL,
    role: 'customer'
  };

  const mockVendor = {
    name: 'Tech Store',
    store_name: 'Tech Store Premium',
    email: 'vendor@test.com'
  };

  const mockLogistics = {
    company_name: 'Fast Delivery Co.',
    contact_email: 'logistics@test.com'
  };

  const mockUser = {
    name: 'Test User',
    email: TEST_EMAIL,
    role: 'customer'
  };

  // All email templates to send
  const emails = [
    {
      name: 'Welcome Email',
      template: welcomeEmail({ user: mockUser })
    },
    {
      name: 'Password Reset',
      template: passwordReset({ 
        user: mockUser, 
        resetLink: 'https://auramarket.com/reset-password?token=abc123xyz' 
      })
    },
    {
      name: 'Order Placed (Customer)',
      template: orderPlaced({ order: mockOrder, customer: mockCustomer })
    },
    {
      name: 'Payment Confirmed',
      template: paymentConfirmed({ order: mockOrder, customer: mockCustomer })
    },
    {
      name: 'Shipment Status Changed',
      template: shipmentStatusChanged({ 
        shipment: mockShipment, 
        order: mockOrder, 
        recipient: mockCustomer,
        status: 'in_transit'
      })
    },
    {
      name: 'Refund Approved',
      template: refundApproved({ order: mockOrder, customer: mockCustomer })
    },
    {
      name: 'Order Completed (Vendor)',
      template: orderCompleted({ order: mockOrder, vendor: mockVendor })
    },
    {
      name: 'New Order For Vendor',
      template: newOrderForVendor({ order: mockOrder, vendor: mockVendor })
    },
    {
      name: 'Shipment Assigned (Logistics)',
      template: shipmentAssigned({ 
        shipment: mockShipment, 
        order: mockOrder, 
        firm: mockLogistics 
      })
    },
    {
      name: 'Refund Requested (Vendor)',
      template: refundRequested({ 
        order: mockOrder, 
        vendor: mockVendor, 
        reason: 'Product not as described' 
      })
    }
  ];

  try {
    console.log('🔄 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Send each email with a delay
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      console.log(`📤 Sending ${email.name}...`);
      
      try {
        const info = await transporter.sendMail({
          from: `"${EMAIL_FROM_NAME || 'Aura Market'}" <${EMAIL_USER}>`,
          to: TEST_EMAIL,
          subject: email.template.subject,
          text: email.template.text,
          html: email.template.html
        });
        console.log(`   ✅ Sent! Message ID: ${info.messageId}`);
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
      }
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ All emails sent!');
    console.log(`\n⏱️  Check your inbox at ${TEST_EMAIL}`);
    console.log(`   (${emails.length} emails - may take a few moments to arrive)`);
    console.log('\n📋 Email Templates Tested:');
    emails.forEach((e, i) => console.log(`   ${i + 1}. ${e.name}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

sendAllEmails();
