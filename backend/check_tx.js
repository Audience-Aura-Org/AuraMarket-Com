const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./models/Transaction.model');

async function checkTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const transactions = await Transaction.find({ 
      amount: 500,
      gateway: 'eversend'
    }).sort('-createdAt').limit(5);

    console.log(`Found ${transactions.length} transactions of 500 XAF via Eversend:`);
    transactions.forEach(tx => {
      console.log(`- ID: ${tx._id}, Ref: ${tx.reference}, Status: ${tx.status}, Created: ${tx.createdAt}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTransactions();
