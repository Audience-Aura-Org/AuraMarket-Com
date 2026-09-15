const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require(path.join(backendDir, 'models', 'User.model'));
  const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));

  const user = await User.findOne({ email: 'ashoctavia118@gmail.com' });
  console.log('Before — wallet_balance:', user.wallet_balance);

  // The vendor had 3 bogus clawbacks from clawbackFoodRefund on new_restaurant_hold
  // orders where the vendor was NEVER credited. The clawback debited the vendor
  // even though the held payout was never released.
  //
  // Bogus clawback #1: Order #946297 — clawback of 2000 (total_amount incl 1500 shipping!)
  //   But held payout was only 500 (subtotal). Vendor debited 2000 for 0 credit.
  // Bogus clawback #2: Order #9462B8 — clawback of 500, vendor never credited.
  // Bogus clawback #3: Order #3E91C1 — clawback of 500, vendor never credited.
  // Total bogus debits: 3000
  //
  // Vendor's legitimate earnings: 3 completed deliveries = 2000 (1000+500+500)
  // Current balance: 500
  // DB has 1500 more than transaction-trail suggests (-1000), likely from
  // initial subscription settlement crediting wallet.
  //
  // The vendor states their correct balance should be 1000.
  // Crediting 500 to restore to their stated correct amount.
  // If they should have more, will investigate further.

  const creditAmount = 500;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await User.findByIdAndUpdate(user._id,
      { $inc: { wallet_balance: creditAmount } },
      { session }
    );

    await Transaction.create([{
      user_id: user._id,
      type: 'refund',
      amount: creditAmount,
      status: 'completed',
      gateway: 'platform',
      reference: `BALANCE-CORRECTION-${Date.now()}`,
      description: 'Balance correction: reversal of bogus clawback on new_restaurant_hold orders (vendor was debited but never credited)',
    }], { session });

    await session.commitTransaction();
    console.log('Credited:', creditAmount);
  } catch (err) {
    await session.abortTransaction();
    console.error('Failed:', err.message);
  } finally {
    session.endSession();
  }

  const updated = await User.findById(user._id).select('wallet_balance').lean();
  console.log('After — wallet_balance:', updated.wallet_balance);

  await mongoose.disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
