const mongoose = require('mongoose');
const Order = require('./models/Order.model');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const checkAnalyticsData = async () => {
  try {
    console.log('🔍 Checking analytics data...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Check total orders
    const totalOrders = await Order.countDocuments();
    console.log(`📊 Total Orders: ${totalOrders}`);

    // Check orders in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    console.log(`📅 Orders (Last 30 days): ${recentOrders}`);

    // Check non-cancelled orders
    const activeOrders = await Order.countDocuments({
      order_status: { $ne: 'cancelled' }
    });
    console.log(`✅ Active Orders (not cancelled): ${activeOrders}`);

    // Sample daily revenue
    const salesByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, order_status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, dailyRevenue: { $sum: "$total_amount" }, orderCount: { $sum: 1 } } },
      { $sort: { "_id": 1 } },
      { $limit: 10 }
    ]);

    console.log(`\n📈 Sample Daily Revenue (first 10 days):`);
    if (salesByDay.length > 0) {
      salesByDay.forEach(day => {
        console.log(`  ${day._id}: ${day.dailyRevenue.toLocaleString()} XAF (${day.orderCount} orders)`);
      });
    } else {
      console.log('  ⚠️  No sales data in last 30 days');
    }

    // Check top vendors
    const topVendors = await Order.aggregate([
      { $match: { order_status: { $ne: 'cancelled' } } },
      { $group: { _id: '$vendor_id', revenue: { $sum: '$total_amount' }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 3 }
    ]);

    console.log(`\n🏪 Top Vendors (by revenue):`);
    if (topVendors.length > 0) {
      topVendors.forEach((v, i) => {
        console.log(`  ${i+1}. Vendor ${v._id}: ${v.revenue.toLocaleString()} XAF (${v.orders} orders)`);
      });
    } else {
      console.log('  ⚠️  No vendor data');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
};

checkAnalyticsData();
