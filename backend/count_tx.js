const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./models/Transaction.model');

async function countTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const total = await Transaction.countDocuments();
    console.log(`Total transactions in DB: ${total}`);

    if (total > 0) {
      const latest = await Transaction.findOne().sort('-createdAt');
      console.log(`Latest transaction: ID ${latest._id}, Amount ${latest.amount}, Status ${latest.status}, Created ${latest.createdAt}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

countTransactions();
