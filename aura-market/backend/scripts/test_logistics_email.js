const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Vendor = require('../models/Vendor.model');
const { sendNotification } = require('../utils/notifier');

async function testLogisticsNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // 1. Target specific test email
    const testRecipient = 'zeroxerxes8@gmail.com';
    console.log(`Testing for: ${testRecipient}`);

    // Find any logistics user just to satisfy DB query if needed (not strictly used if we override)
    const logistics = await LogisticsCompany.findOne().populate('user_id');
    const recipientId = logistics?.user_id?._id || new mongoose.Types.ObjectId();

    // 2. Create MOCK Order-like object
    const mockOrder = {
      _id: new mongoose.Types.ObjectId(),
      total_amount: 15500,
      products: [
        { name: 'Elite Leather Boots', quantity: 1, price: 12000 },
        { name: 'Urban Tech Socks', quantity: 2, price: 1750 }
      ],
      shipping_address: {
        name: 'John Doe',
        street: 'Rue Maréchal Foch',
        quartier: 'Akwa',
        phone: '+237 600 000 000'
      },
      vendor_id: {
        store_name: 'Aura Premium Store',
        phone: '+237 611 111 111',
        pickup_address: {
          street: 'Boulevard de la Liberté',
          quartier: 'Bonanjo',
          city: 'Douala'
        }
      }
    };

    // 3. Send Notification (mocking Express app for get() call)
    const mockApp = { get: () => null };

    await sendNotification(mockApp, recipientId, {
      title: 'TEST: New Shipment Assigned',
      message: `You have new delivery work for Order #${mockOrder._id.toString().slice(-6).toUpperCase()}.`,
      type: 'system_alert',
      metadata: { order_id: mockOrder._id, link: '/logistics/dashboard' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`,
      orderDetails: mockOrder,
      role: 'logistics',
      overrideEmail: testRecipient
    });

    console.log('Test notification sent successfully!');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB');
  }
}

testLogisticsNotification();
