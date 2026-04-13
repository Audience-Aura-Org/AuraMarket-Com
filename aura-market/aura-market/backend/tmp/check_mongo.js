const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('No MONGODB_URI in .env');
  process.exit(1);
}

(async () => {
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB:', conn.connection.host);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Mongo connection error:', e.message);
    process.exit(1);
  }
})();
