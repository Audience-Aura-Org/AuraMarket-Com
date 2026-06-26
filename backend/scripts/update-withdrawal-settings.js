require('dotenv').config();

const mongoose = require('mongoose');
const PlatformSettings = require('../models/PlatformSettings.model');

const MONGODB_URI = process.env.MONGODB_URI;

const main = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(MONGODB_URI);
  const settings = await PlatformSettings.getSettings();
  settings.withdrawal_fee = 500;
  settings.min_withdrawal_amount = 500;
  await settings.save();

  console.log('Withdrawal settings updated:', {
    withdrawal_fee: settings.withdrawal_fee,
    min_withdrawal_amount: settings.min_withdrawal_amount,
  });

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
