require('dotenv').config();

const connectDB = require('../config/database');
const PlatformSettings = require('../models/PlatformSettings.model');

const run = async () => {
  await connectDB();
  const settings = await PlatformSettings.getSettings();

  settings.commission_type = 'percentage';
  settings.commission_value = 5;
  settings.commission_rate = 5;
  settings.escrow_fee_type = settings.escrow_fee_type || 'percentage';
  settings.escrow_fee_value = Number(settings.escrow_fee_value || 0);
  await settings.save();

  console.log('Platform commerce fees updated:', {
    commission_type: settings.commission_type,
    commission_value: settings.commission_value,
    commission_rate: settings.commission_rate,
    mobile_money_collection_fee_xaf: Number(process.env.MOBILE_MONEY_COLLECTION_FEE_XAF || 5),
  });
  process.exit(0);
};

run().catch((error) => {
  console.error('Failed to update platform commerce fees:', error);
  process.exit(1);
});
