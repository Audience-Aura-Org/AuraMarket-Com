const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./models/Transaction.model');

async function checkRecentTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const transactions = await Transaction.find({ 
      createdAt: { $gte: twentyFourHoursAgo }
    }).sort('-createdAt').limit(20);

    console.log(`Found ${transactions.length} transactions in the last 24 hours:`);
    transactions.forEach(tx => {
      console.log(`- ID: ${tx._id}, Ref: ${tx.reference}, Type: ${tx.type}, Amount: ${tx.amount}, Status: ${tx.status}, Gateway: ${tx.gateway}, Created: ${tx.createdAt}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkRecentTransactions();
