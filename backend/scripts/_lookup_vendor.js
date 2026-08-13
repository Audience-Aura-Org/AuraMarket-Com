require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
require('../models/Store.model');
require('../models/LogisticZone.model');
const RestaurantProfile = require('../models/RestaurantProfile.model');
const Product           = require('../models/Product.model');
const Order             = require('../models/Order.model');
const Store             = require('../models/Store.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const id = new mongoose.Types.ObjectId('6a7a672b215b7c02f8a55e21');

  const r1 = await RestaurantProfile.deleteMany({ vendor_id: id });
  const r2 = await Product.deleteMany({ vendor_id: id });
  const r3 = await Order.deleteMany({ vendor_id: id });
  const r4 = await Store.deleteMany({ vendor_id: id });

  console.log('RestaurantProfiles deleted:', r1.deletedCount);
  console.log('Products deleted:',          r2.deletedCount);
  console.log('Orders deleted:',            r3.deletedCount);
  console.log('Stores deleted:',            r4.deletedCount);

  await mongoose.disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
