const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');

dns.setServers(['8.8.8.8', '8.8.4.4']);
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Status = require('./models/Status.model');
const Vendor = require('./models/Vendor.model');
const User = require('./models/User.model');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 15000,
    });
    console.log('Connected');
    
    const now = new Date();
    const query = { expires_at: { $gt: now } };
    
    const statuses = await Status.find(query)
      .sort({ likes_count: -1, createdAt: -1 })
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id',
        populate: { path: 'user_id', select: 'avatar branding' }
      })
      .lean();
    
    console.log('Query result count:', statuses.length);
    if (statuses.length > 0) {
      console.log('First result vendor name:', statuses[0].vendor_id?.store_name);
      console.log('First result user branding:', statuses[0].vendor_id?.user_id?.branding);
    } else {
      console.log('No statuses found with the query');
      const allCount = await Status.countDocuments({});
      console.log('Total statuses in DB (even expired):', allCount);
      if (allCount > 0) {
        const one = await Status.findOne({}).lean();
        console.log('Sample status info:', {
          id: one._id,
          expires_at: one.expires_at,
          now: now
        });
      }
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
