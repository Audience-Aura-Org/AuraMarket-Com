const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User.model');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { JWT_SECRET } = require('./config/env');

const testAnalyticsAPI = async () => {
  try {
    console.log('🧪 Testing /admin/analytics/advanced endpoint...\n');

    // Get a valid admin token
    await mongoose.connect(process.env.MONGODB_URI);
    const admin = await User.findOne({ role: 'admin' }).limit(1);
    
    if (!admin) {
      console.error('❌ No admin user found');
      process.exit(1);
    }

    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`✅ Generated token for admin: ${admin.name}\n`);

    // Test the endpoint
    const response = await axios.get('http://localhost:5000/api/admin/analytics/advanced', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data?.success) {
      console.log('✅ API Response: SUCCESS\n');
      console.log('📊 Data Summary:');
      console.log(`  Sales Over Time: ${response.data.data?.sales_over_time?.length || 0} days`);
      console.log(`  Top Vendors: ${response.data.data?.top_vendors?.length || 0}`);
      console.log(`  Top Products: ${response.data.data?.top_products?.length || 0}`);
      console.log(`  Role Breakdown: ${response.data.data?.role_breakdown?.length || 0} roles`);
      console.log(`  Category Stats: ${response.data.data?.category_stats?.length || 0} categories`);
      console.log(`  Order Matrix: ${response.data.data?.order_matrix?.length || 0} statuses`);
      console.log(`  Total Revenue: ${response.data.data?.payout_intel?.total_revenue?.toLocaleString()} XAF`);
      console.log(`  Platform Users: ${response.data.data?.platform_summary?.total_users}`);

      if (response.data.data?.sales_over_time?.length > 0) {
        console.log(`\n📈 Sales Over Time (first 3 days):`);
        response.data.data.sales_over_time.slice(0, 3).forEach(day => {
          console.log(`  ${day._id}: ${day.dailyRevenue.toLocaleString()} XAF`);
        });
      }
    } else {
      console.log('❌ API Response: FAILED');
      console.log(response.data);
    }

  } catch (err) {
    console.error('❌ Error:', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
      data: err.response?.data
    });
  } finally {
    await mongoose.connection.close();
  }
};

testAnalyticsAPI();
