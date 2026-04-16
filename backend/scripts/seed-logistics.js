const mongoose = require('mongoose');
const URI = 'mongodb+srv://batitaasah_db_user:ZKqwG9woO4mipI3H@cluster0.dl8yopt.mongodb.net/aura-market';
const LogisticsCompany = require('../models/LogisticsCompany.model');
const User = require('../models/User.model');

async function seed() {
  try {
    await mongoose.connect(URI);
    console.log("Connected.");
    const users = await User.find({ role: 'logistics' });
    
    for (const user of users) {
      const existing = await LogisticsCompany.findOne({ user_id: user._id });
      if (!existing) {
        await LogisticsCompany.create({
          user_id: user._id,
          company_name: user.email.split('@')[0].toUpperCase() + ' Logistics',
          contact_email: user.email,
          contact_phone: '+237 000000000',
          service_regions: ['Douala', 'Yaoundé'],
          vehicle_types: ['motorcycle', 'car'],
          is_verified: true
        });
        console.log(`Created firm for ${user.email}`);
      }
    }
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
seed();
