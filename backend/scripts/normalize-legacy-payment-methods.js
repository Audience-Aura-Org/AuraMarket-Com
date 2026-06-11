require('dotenv').config();

const connectDB = require('../config/database');
const Order = require('../models/Order.model');

const run = async () => {
  await connectDB();

  const result = await Order.updateMany(
    { payment_method: { $in: ['mesomb', 'mobile_money'] } },
    { $set: { payment_method: 'eversend' } }
  );

  console.log(`[normalize-legacy-payment-methods] matched=${result.matchedCount || 0} modified=${result.modifiedCount || 0}`);
  process.exit(0);
};

run().catch((error) => {
  console.error('[normalize-legacy-payment-methods] failed:', error);
  process.exit(1);
});
