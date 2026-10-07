const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const User = require(path.join(backendDir, 'models', 'User.model'));

  const emails = ['ashoctavia118@gmail.com', 'uniquevoss@gmail.com'];
  for (const email of emails) {
    const user = await User.findOne({ email }).select('name email wallet_balance').lean();
    if (user) {
      console.log(`${user.email} (${user.name}): ${user.wallet_balance} XAF`);
    } else {
      console.log(`${email}: NOT FOUND`);
    }
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
