const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Transaction = require('./models/Transaction.model');

async function purgeExternalTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete transactions that don't start with AURA or TEST
    const result = await Transaction.deleteMany({
      reference: { $not: /^AURA/i, $not: /^TEST/i }
    });

    console.log(`Purged ${result.deletedCount} non-platform transactions.`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

purgeExternalTransactions();
