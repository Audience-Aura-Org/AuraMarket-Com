const mongoose = require('mongoose');
const URI = 'mongodb+srv://batitaasah_db_user:ZKqwG9woO4mipI3H@cluster0.dl8yopt.mongodb.net/aura-market';
const LogisticsCompany = require('../models/LogisticsCompany.model');
const User = require('../models/User.model');

async function check() {
  try {
    await mongoose.connect(URI);
    console.log("Connected.");
    const users = await User.find({ role: 'logistics' });
    console.log(`Logistics Users: ${users.length}`);
    users.forEach(u => console.log(`- ${u.email} (${u._id})`));

    const firms = await LogisticsCompany.find();
    console.log(`Firms: ${firms.length}`);
    firms.forEach(f => console.log(`- ${f.company_name} (Verified: ${f.is_verified})`));
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
