const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Order = require('../models/Order.model');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log('Connected to DB');

    const orders = await Order.find({ subtotal: { $lte: 10 } }).lean();
    console.log(`Found ${orders.length} orders with subtotal <= 10`);
    for (const order of orders) {
      console.log(`Order ID: ${order._id}`);
      console.log(`  Subtotal: ${order.subtotal}`);
      console.log(`  Shipping Fee: ${order.shipping_fee}`);
      console.log(`  Total Amount: ${order.total_amount}`);
      console.log(`  Products:`, order.products.map(p => `${p.name} (price: ${p.price}, qty: ${p.quantity})`));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
