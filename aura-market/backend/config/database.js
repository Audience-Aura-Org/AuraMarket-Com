/**
 * config/database.js
 * MongoDB connection using Mongoose.
 * Connects to the URI defined in environment variables.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️ Server will continue in restricted mode (no-DB).');
  }
};

module.exports = connectDB;
