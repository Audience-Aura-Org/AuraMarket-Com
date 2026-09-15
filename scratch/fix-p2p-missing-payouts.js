/**
 * fix-p2p-missing-payouts.js
 *
 * One-time reconciliation script: finds all P2P shipments that are marked
 * "delivered" and "paid" but have no corresponding payout transaction for
 * the logistics firm. Credits the firm and creates the payout record.
 *
 * Usage:
 *   cd backend && node ../scratch/fix-p2p-missing-payouts.js
 *
 * Dry-run first (default):    DRY_RUN=1 node fix-p2p-missing-payouts.js
 * Actually apply:             DRY_RUN=0 node ../scratch/fix-p2p-missing-payouts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Shipment = require('./models/Shipment.model');
const LogisticsCompany = require('./models/LogisticsCompany.model');
const Transaction = require('./models/Transaction.model');
const User = require('./models/User.model');

const DRY_RUN = (process.env.DRY_RUN ?? '1') !== '0';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`[fix-p2p-payouts] Connected. DRY_RUN=${DRY_RUN}`);

  // Find all delivered + paid P2P shipments
  const deliveredShipments = await Shipment.find({
    type: 'p2p',
    status: 'delivered',
    payment_status: 'paid',
  })
    .populate('logistics_id', 'user_id company_name')
    .lean();

  console.log(`[fix-p2p-payouts] Found ${deliveredShipments.length} delivered P2P shipments.`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const shipment of deliveredShipments) {
    const firm = shipment.logistics_id;
    if (!firm || !firm.user_id) {
      console.log(`  SKIP ${shipment.tracking_code}: no logistics firm linked`);
      skipped++;
      continue;
    }

    // Check if payout already exists
    const existing = await Transaction.findOne({
      user_id: firm.user_id,
      type: 'payout',
      description: { $regex: shipment.tracking_code },
    }).lean();

    if (existing) {
      console.log(`  SKIP ${shipment.tracking_code}: payout already exists (txn ${existing._id})`);
      skipped++;
      continue;
    }

    // Calculate payout amount
    const payoutAmount = shipment.base_price
      ? shipment.base_price
      : (shipment.price - (shipment.platform_fee || 0));

    if (payoutAmount <= 0) {
      console.log(`  SKIP ${shipment.tracking_code}: payout amount is ${payoutAmount}`);
      skipped++;
      continue;
    }

    console.log(`  FIX  ${shipment.tracking_code}: credit ${payoutAmount} XAF to ${firm.company_name} (user ${firm.user_id})`);

    if (!DRY_RUN) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Credit balance
          await User.findOneAndUpdate(
            { _id: firm.user_id },
            { $inc: { wallet_balance: payoutAmount } },
            { session }
          );

          // Create transaction record
          await Transaction.create([{
            user_id:     firm.user_id,
            type:        'payout',
            amount:      payoutAmount,
            reference:   `P2P-PAYOUT-RECONCILE-${shipment.tracking_code}`,
            status:      'completed',
            description: `P2P delivery payout — ${shipment.tracking_code}`,
            gateway:     'wallet',
            metadata:    { tracking_code: shipment.tracking_code, shipment_id: shipment._id, type: 'p2p', reconciled: true },
          }], { session });
        });

        fixed++;
        console.log(`       ✓ Done.`);
      } catch (err) {
        console.error(`       ✗ Error: ${err.message}`);
        errors++;
      } finally {
        await session.endSession();
      }
    } else {
      fixed++;
    }
  }

  console.log(`\n[fix-p2p-payouts] Summary: ${fixed} fixed, ${skipped} skipped, ${errors} errors.`);
  if (DRY_RUN) console.log('[fix-p2p-payouts] This was a DRY RUN. Set DRY_RUN=0 to apply.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[fix-p2p-payouts] Fatal:', err);
  process.exit(1);
});
