const mongoose = require('mongoose');
const User = require('./models/User.model');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { JWT_SECRET } = require('./config/env');

const getValidToken = async () => {
  try {
    console.log('🔍 Fetching a test user from database...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Get first user
    const user = await User.findOne().limit(1);
    
    if (!user) {
      console.error('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);

    // Generate JWT token for this user
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`\n📝 Valid JWT Token:\nBearer ${token}`);
    console.log(`\n✅ User ID: ${user._id}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
};

getValidToken();
