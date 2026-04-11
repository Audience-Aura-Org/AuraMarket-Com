/**
 * config/database.js
 * MongoDB connection using Mongoose.
 * Connects to the URI defined in environment variables.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // Timeout after 15s instead of 30s
      heartbeatFrequencyMS: 10000,    // Check connection every 10s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // If it's a DNS issue, wait and try again once or log specifically
    if (error.message.includes('ENOTFOUND')) {
      console.warn('⚠️ DNS Resolution failed for MongoDB Atlas. If you are on a restricted network, check your DNS settings.');
    }
  }
};

module.exports = connectDB;
