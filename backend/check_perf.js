require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order.model');
const Transaction = require('./models/Transaction.model');

async function checkPerformance() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.time('Order Count');
  const orderCount = await Order.countDocuments();
  console.timeEnd('Order Count');
  
  console.time('Transaction Count');
  const txCount = await Transaction.countDocuments();
  console.timeEnd('Transaction Count');
  
  console.log(`Orders: ${orderCount}`);
  console.log(`Transactions: ${txCount}`);
  
  console.time('Order Fetch (limit 30)');
  await Order.find({}).limit(30).lean();
  console.timeEnd('Order Fetch (limit 30)');
  
  console.time('Transaction Fetch (limit 50)');
  await Transaction.find({}).limit(50).lean();
  console.timeEnd('Transaction Fetch (limit 50)');
  
  process.exit(0);
}

checkPerformance();
