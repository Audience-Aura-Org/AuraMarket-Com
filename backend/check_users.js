require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User.model');

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).limit(5);
  console.log('Recent Users:', users.map(u => ({ email: u.email, role: u.role })));
  process.exit(0);
}

checkUsers();
