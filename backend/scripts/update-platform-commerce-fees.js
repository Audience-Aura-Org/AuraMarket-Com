require('dotenv').config();

const connectDB = require('../config/database');
const PlatformSettings = require('../models/PlatformSettings.model');

const run = async () => {
  await connectDB();
  const settings = await PlatformSettings.getSettings();
  const commissionValue = process.env.ADMIN_COMMISSION_VALUE ?? process.env.ADMIN_COMMISSION_PERCENT;
  const escrowFeeValue = process.env.ESCROW_COMMISSION_VALUE ?? process.env.ESCROW_FEE_VALUE;

  settings.commission_type = settings.commission_type || 'percentage';
  if (commissionValue !== undefined) {
    settings.commission_value = Number(commissionValue);
    settings.commission_rate = settings.commission_type === 'percentage' ? settings.commission_value : 0;
  } else if (settings.commission_value === undefined || settings.commission_value === null) {
    settings.commission_value = Number(settings.commission_rate || 0);
    settings.commission_rate = settings.commission_type === 'percentage' ? settings.commission_value : 0;
  }

  settings.escrow_fee_type = settings.escrow_fee_type || 'percentage';
  if (escrowFeeValue !== undefined) {
    settings.escrow_fee_value = Number(escrowFeeValue);
  } else if (settings.escrow_fee_value === undefined || settings.escrow_fee_value === null) {
    settings.escrow_fee_value = 0;
  }
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
