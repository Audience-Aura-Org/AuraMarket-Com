const mongoose = require('mongoose');
const Transaction = require('./models/Transaction.model');
const User = require('./models/User.model');
require('dotenv').config();

async function checkLatest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const txs = await Transaction.find({ type: 'deposit' })
    .sort({ createdAt: -1 })
    .limit(5);

  console.log('Latest Deposits:');
  for (const tx of txs) {
    const user = await User.findById(tx.user_id);
    console.log(`Ref: ${tx.reference}, Status: ${tx.status}, Amount: ${tx.amount}, Gateway: ${tx.gateway}, GatewayID: ${tx.gateway_transaction_id}, Created: ${tx.createdAt}, User: ${user?.name} (Balance: ${user?.wallet_balance})`);
    console.log('Metadata:', JSON.stringify(tx.metadata));
  }
  
  process.exit(0);
}

checkLatest().catch(console.error);
