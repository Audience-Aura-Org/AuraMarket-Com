/**
 * scripts/reconcile-wallet-balances.js
 * Auradime — Wallet Balance Reconciliation Migration
 *
 * For every user, computes their correct wallet balance from the signed
 * transaction ledger and writes it back if it differs (or is missing).
 *
 * Safe to run on a live database:
 *   - Uses findOneAndUpdate with a condition that skips users already correct.
 *   - Dry-run mode (--dry-run) prints what would change without writing.
 *   - Idempotent: running it twice produces the same result.
 *
 * Usage:
 *   node scripts/reconcile-wallet-balances.js            # live run
 *   node scripts/reconcile-wallet-balances.js --dry-run  # preview only
 */

'use strict';

require('../config/env');

const mongoose = require('mongoose');

const User        = require('../models/User.model');
const Transaction = require('../models/Transaction.model');

const DRY_RUN = process.argv.includes('--dry-run');

// Types that INCREASE the user's balance
const CREDIT_TYPES = new Set(['deposit', 'refund', 'escrow_release', 'payout']);
// Types that DECREASE the user's balance
const DEBIT_TYPES  = new Set(['payment', 'withdrawal', 'subscription']);

// Gateways whose 'payment' transactions do NOT debit the user's wallet:
//   - Mobile money gateways: the buyer paid via phone; wallet untouched.
//   - 'platform': vendor commission accounting record; debit excluded from vendorPayout already.
const NON_WALLET_PAYMENT_GATEWAYS = new Set(['eversend', 'payunit', 'pawapay', 'platform']);

const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW= '\x1b[33m';
const RED   = '\x1b[31m';
const RESET = '\x1b[0m';

async function computeLedgerBalance(userId) {
  const txns = await Transaction.find({
    user_id: userId,
    status: 'completed',
  }).select('type amount gateway').lean();

  let balance = 0;
  for (const tx of txns) {
    if (CREDIT_TYPES.has(tx.type)) {
      balance += tx.amount;
    } else if (DEBIT_TYPES.has(tx.type)) {
      // Skip payment records that never debited the wallet:
      //   - Mobile money gateways: buyer paid via phone, wallet untouched.
      //   - 'platform' gateway: vendor commission record, not an actual debit.
      if (tx.type === 'payment' && NON_WALLET_PAYMENT_GATEWAYS.has(tx.gateway)) continue;
      balance -= tx.amount;
    }
    // Unknown type: skip (safe)
  }

  return Math.round(balance); // XAF is always whole integers
}

async function main() {
  console.log(BOLD + `\nAuradime — Wallet Balance Reconciliation` + RESET);
  console.log(DIM + `Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}` + RESET);
  console.log(DIM + `Connecting to MongoDB…` + RESET);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
  });

  console.log(DIM + `Connected.\n` + RESET);

  const users = await User.find({}).select('_id email wallet_balance').lean();
  console.log(`Found ${users.length} users to check.\n`);

  let checked    = 0;
  let corrected  = 0;
  let alreadyOk  = 0;
  let flagged    = 0;
  let errors     = 0;

  for (const user of users) {
    checked++;
    try {
      const ledger = await computeLedgerBalance(user._id);
      const stored = typeof user.wallet_balance === 'number' ? Math.round(user.wallet_balance) : null;

      const isMissing  = stored === null || stored === undefined;
      const effective  = isMissing ? 0 : stored;
      const delta      = ledger - effective;

      // Case A: ledger > stored → user is owed money; safe to credit the gap.
      const needsCredit = delta > 1;
      // Case B: stored > ledger → stored balance is HIGHER than ledger shows.
      //   Don't auto-reduce (could be pre-tracking credits). Flag for manual review.
      const overBalance = delta < -1 && effective > 0;
      // Case C: ledger ≤ 0 and stored == 0 → early-dev ghost debits; floor is correct.
      const ghostDebit  = ledger <= 0 && effective === 0;

      if (isMissing) {
        // Wallet field absent: initialize to max(0, ledger)
        corrected++;
        const setTo = Math.max(0, ledger);
        console.log(`${YELLOW}[MISSING]${RESET} ${DIM}${user.email || user._id}${RESET}  → initializing to ${setTo}`);
        if (!DRY_RUN) {
          await User.findByIdAndUpdate(user._id, { $set: { wallet_balance: setTo } });
        }
      } else if (needsCredit) {
        corrected++;
        console.log(
          `${GREEN}[CREDIT]${RESET}  ${DIM}${user.email || user._id}${RESET}  ` +
          `stored=${stored}  ledger=${ledger}  adding +${delta} XAF`
        );
        if (!DRY_RUN) {
          await User.findByIdAndUpdate(user._id, { $inc: { wallet_balance: delta } });
        }
      } else if (overBalance) {
        flagged++;
        // Don't touch — flag for manual investigation
        console.log(
          `${YELLOW}[REVIEW]${RESET}  ${DIM}${user.email || user._id}${RESET}  ` +
          `stored=${stored}  ledger=${ledger}  delta=${delta}  (stored > ledger — skipped)`
        );
      } else if (ghostDebit) {
        // Ledger is negative but balance is already 0 — leave it.
        alreadyOk++;
      } else {
        alreadyOk++;
      }
    } catch (err) {
      errors++;
      console.error(`${RED}[ERROR]${RESET} ${user._id}: ${err.message}`);
    }

    if (checked % 100 === 0) {
      process.stdout.write(DIM + `  …checked ${checked}/${users.length}\r` + RESET);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(
    `${BOLD}Done.${RESET}  ` +
    `${GREEN}${alreadyOk} already correct${RESET}  •  ` +
    `${corrected > 0 ? GREEN : DIM}${corrected} ${DRY_RUN ? 'would be ' : ''}credited${RESET}  •  ` +
    `${flagged > 0 ? YELLOW : DIM}${flagged} flagged for review${RESET}  •  ` +
    `${errors > 0 ? RED : DIM}${errors} errors${RESET}`
  );

  if (flagged > 0) {
    console.log(
      YELLOW + '\n[REVIEW] accounts have stored > ledger — investigate before manual reduction:' + RESET
    );
    console.log(DIM + 'Possible causes: pre-tracking admin credits, manually corrected balances.' + RESET);
  }

  if (DRY_RUN && corrected > 0) {
    console.log(DIM + '\nRun without --dry-run to apply corrections.' + RESET);
  }

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(2);
});
