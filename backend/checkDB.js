const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Status = require('./models/Status.model');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    
    const count = await Status.countDocuments({ expires_at: { $gt: new Date() } });
    console.log('Active statuses count:', count);
    
    const all = await Status.find({}).limit(5).lean();
    console.log('Sample statuses:', JSON.stringify(all, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
