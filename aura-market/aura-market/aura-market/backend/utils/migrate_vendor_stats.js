/**
 * utils/migrate_vendor_stats.js
 * Tool to synchronize vendor statistics based on existing order data.
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Ensure models are registered correctly
const Order = require('../models/Order.model');
const Vendor = require('../models/Vendor.model');

const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB for Migration');

    const vendors = await Vendor.find();
    console.log(`Found ${vendors.length} vendors to reconcile.`);

    for (const vendor of vendors) {
      // Find all non-cancelled orders for this vendor
      const orders = await Order.find({ 
        vendor_id: vendor._id, 
        order_status: { $nin: ['cancelled'] },
        payment_status: { $in: ['paid', 'completed'] }
      });

      const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const totalSales = orders.length;

      vendor.total_revenue = totalRevenue;
      vendor.total_sales = totalSales;
      await vendor.save();

      console.log(`Updated [${vendor.store_name}]: ${totalSales} sales | ${totalRevenue.toLocaleString()} Revenue`);
    }

    console.log('🎉 Migration Complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  });
