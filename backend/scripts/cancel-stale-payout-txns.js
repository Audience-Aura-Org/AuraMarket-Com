/**
 * scripts/cancel-stale-payout-txns.js
 * Auradime — One-time fix for pending payout transactions left dangling
 * after full_refund / food_full_refund dispute resolutions.
 *
 * Background:
 *   When an admin resolves a dispute as full_refund or food_full_refund, the
 *   dispute controller used to forget to cancel the vendor's pending payout
 *   transaction. This left orphan rows with status:'pending' that will never
 *   settle. This script finds and cancels them.
 *
 * Safe to run on a live database:
 *   - Dry-run mode (--dry-run) prints what would change without writing.
 *   - Only touches transactions in status:'pending' linked to orders whose
 *     dispute was resolved as a refund — zero risk of affecting live orders.
 *   - Idempotent: running it twice produces the same result.
 *
 * Usage:
 *   node scripts/cancel-stale-payout-txns.js            # live run
 *   node scripts/cancel-stale-payout-txns.js --dry-run  # preview only
 */

'use strict';

require('../config/env');

const mongoose    = require('mongoose');
const Dispute     = require('../models/Dispute.model');
const Transaction = require('../models/Transaction.model');

const DRY_RUN = process.argv.includes('--dry-run');

const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

async function main() {
  console.log(BOLD + '\nAuradime — Cancel Stale Pending Payout Transactions' + RESET);
  console.log(DIM + `Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}` + RESET);
  console.log(DIM + 'Connecting to MongoDB…' + RESET);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
  });
  console.log(DIM + 'Connected.\n' + RESET);

  // 1. Find all disputes that were resolved as a refund (buyer gets money back)
  const refundedDisputes = await Dispute.find({
    status:          'resolved',
    resolution_type: { $in: ['full_refund', 'food_full_refund'] },
  }).select('order_id resolution_type resolved_at').lean();

  console.log(`Found ${refundedDisputes.length} refund-resolved disputes to check.\n`);

  let checked   = 0;
  let cancelled = 0;
  let alreadyOk = 0;
  let errors    = 0;

  for (const dispute of refundedDisputes) {
    checked++;
    try {
      const orderId = dispute.order_id;

      // Look for any pending payout transaction tied to this order
      const stale = await Transaction.findOne({
        order_id: orderId,
        type:     'payout',
        status:   'pending',
      }).select('_id user_id amount description createdAt').lean();

      if (!stale) {
        alreadyOk++;
        continue;
      }

      cancelled++;
      console.log(
        `${YELLOW}[CANCEL]${RESET}  order=${orderId.toString().slice(-6).toUpperCase()}` +
        `  type=${dispute.resolution_type}` +
        `  txn=${stale._id}` +
        `  amount=${stale.amount} XAF` +
        `  created=${stale.createdAt?.toISOString?.() ?? '?'}`
      );

      if (!DRY_RUN) {
        await Transaction.findOneAndUpdate(
          { _id: stale._id, status: 'pending' },  // status guard for idempotency
          {
            $set: {
              status:      'cancelled',
              description: `Cancelled by migration: dispute resolved as ${dispute.resolution_type} on ${dispute.resolved_at?.toISOString?.() ?? 'unknown date'}.`,
            },
          }
        );
      }
    } catch (err) {
      errors++;
      console.error(`${RED}[ERROR]${RESET} dispute ${dispute._id}: ${err.message}`);
    }

    if (checked % 50 === 0) {
      process.stdout.write(DIM + `  …checked ${checked}/${refundedDisputes.length}\r` + RESET);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `${BOLD}Done.${RESET}  ` +
    `${GREEN}${alreadyOk} already clean${RESET}  •  ` +
    `${cancelled > 0 ? YELLOW : DIM}${cancelled} ${DRY_RUN ? 'would be ' : ''}cancelled${RESET}  •  ` +
    `${errors > 0 ? RED : DIM}${errors} errors${RESET}`
  );

  if (DRY_RUN && cancelled > 0) {
    console.log(DIM + '\nRun without --dry-run to apply.' + RESET);
  }

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(2);
});
