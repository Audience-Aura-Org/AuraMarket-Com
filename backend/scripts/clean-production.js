const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Force Google DNS to bypass local DNS issues with SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI;

const cleanProduction = async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // List of models to clear completely
    const modelsToClear = [
      'Order',
      'Shipment',
      'Escrow',
      'Transaction',
      'Product',
      'Status',
      'Store',
      'Vendor',
      'LogisticsCompany',
      'UserSubscription',
      'UserActivity',
      'AuditLog',
      'Message',
      'Notification',
      'Follow',
      'Cart',
      'RefundRequest',
      'Dispute',
      'KYC',
      'Wishlist',
      'Coupon',
      'EmailLog',
      'PushSubscription',
      'Question',
      'RecentlyViewed',
      'Report',
      'Review',
      'StockWatch',
      'WithdrawalRequest'
    ];

    for (const modelName of modelsToClear) {
      try {
        const Model = mongoose.model(modelName);
        await Model.deleteMany({});
        console.log(`🧹 Cleared all documents in model: ${modelName}`);
      } catch (err) {
        // If model is not registered yet, require it dynamically
        try {
          const Model = require(`../models/${modelName}.model`);
          await Model.deleteMany({});
          console.log(`🧹 Cleared all documents in model: ${modelName}`);
        } catch (requireErr) {
          console.warn(`⚠️ Could not clear model ${modelName}: ${requireErr.message}`);
        }
      }
    }

    // Clean up Users table
    // Delete all users except admin accounts
    const User = require('../models/User.model');
    const result = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`🧹 Cleared ${result.deletedCount} non-admin users.`);

    // Reset wallet balance of remaining admin accounts
    await User.updateMany({ role: 'admin' }, { $set: { wallet_balance: 0 } });
    console.log('🧹 Reset wallet balance of all admin accounts to 0.');

    console.log('🎉 Production clean completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Clean failed:', error);
    process.exit(1);
  }
};

cleanProduction();
