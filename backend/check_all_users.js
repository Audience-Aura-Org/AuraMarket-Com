const mongoose = require('mongoose');
const User = require('./models/User.model');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).select('name wallet_balance role');
  console.log('All Users:');
  users.forEach(u => console.log(`${u.name} (${u.role}): ${u.wallet_balance}`));
  process.exit(0);
}

checkUsers().catch(console.error);
