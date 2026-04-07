const mongoose = require('mongoose');
require('dotenv').config();

async function checkAruraLogo() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('./backend/models/User.model');
  const LogisticsCompany = require('./backend/models/LogisticsCompany.model');
  
  const aura = await LogisticsCompany.findOne({ company_name: 'Aura Deliveries' }).populate('user_id');
  console.log('--- Aura Deliveries Node ---');
  console.log('Company Name:', aura.company_name);
  console.log('User ID:', aura.user_id?._id);
  console.log('User Branding:', aura.user_id?.branding);
  console.log('User Avatar:', aura.user_id?.avatar);
  
  process.exit();
}

checkAruraLogo();
