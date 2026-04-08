/**
 * scripts/test_notification_email.js
 * Quick test to send a notification email to a specific address
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notifier');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aura_market';
const TEST_EMAIL = process.argv[2] || 'brandonasah11@gmail.com';

const mockApp = {
  get: () => null // Mock Socket.io (no real-time needed for this test)
};

async function sendTestNotification() {
  try {
    console.log('📧 Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create a mock order object for demonstration
    const mockOrder = {
      _id: new mongoose.Types.ObjectId(),
      total_amount: 50000,
      payment_method: 'pay_on_delivery',
      products: [
        {
          name: 'Premium Wireless Headphones',
          price: 25000,
          quantity: 2
        },
        {
          name: 'Phone Case',
          price: 4000,
          quantity: 1
        }
      ]
    };

    console.log(`\n📤 Sending test order notification to: ${TEST_EMAIL}`);
    console.log(`📋 Order Details:`);
    console.log(`   - Total: XAF ${mockOrder.total_amount.toLocaleString()}`);
    console.log(`   - Method: ${mockOrder.payment_method}`);
    console.log(`   - Items: ${mockOrder.products.length}`);

    // Create a temporary user document for the email recipient
    const User = require('../models/User.model');
    
    // Check if user exists, if not create a temporary one
    let testUser = await User.findOne({ email: TEST_EMAIL });
    if (!testUser) {
      console.log(`\n⚠️  User not found. Creating temporary test user...`);
      testUser = await User.create({
        email: TEST_EMAIL,
        name: 'Test Recipient',
        role: 'customer',
        phone: '+1234567890',
        password: 'test_password_do_not_use'
      });
      console.log(`✅ Temporary test user created: ${testUser._id}`);
    } else {
      console.log(`\n✅ Found existing user: ${testUser.name} (${testUser.email})`);
    }

    // Send order confirmation notification
    await sendNotification(mockApp, testUser._id, {
      title: 'Order Confirmed (POD) - Test Notification',
      message: 'Your Pay-on-Delivery order has been successfully placed and confirmed by our system.',
      type: 'order_status',
      metadata: { order_id: mockOrder._id, link: '/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/orders/${mockOrder._id}`,
      orderDetails: mockOrder,
      role: 'customer',
      overrideEmail: TEST_EMAIL // Force send to specific email
    });

    console.log(`\n✅ Test notification dispatched successfully!`);
    console.log(`📧 Email will be sent to: ${TEST_EMAIL}`);
    console.log(`⏱️  Check your inbox (may take a few moments to arrive)`);

  } catch (err) {
    console.error(`\n❌ Error sending test notification:`, err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    process.exit(0);
  }
}

sendTestNotification();
