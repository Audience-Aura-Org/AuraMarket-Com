/**
 * audit-double-deposits.js
 *
 * Finds users whose wallet_balance is higher than what their completed
 * transaction history accounts for — the tell-tale sign of a double-credit
 * caused by the webhook + polling-verify race condition (fixed in payment.controller.js).
 *
 * HOW IT WORKS
 * ────────────
 * For every user who has at least one completed gateway deposit we:
 *   1. Sum all completed CREDIT transactions  → +wallet
 *   2. Sum all completed DEBIT  transactions  → -wallet
 *   3. Compare expected_balance with the stored wallet_balance
 *   4. If actual > expected by more than 1 XAF (float noise guard) we
 *      flag it and try to match the excess to a specific deposit amount.
 *
 * CREDIT types  : deposit (no order_ids), refund, payout, escrow_release
 * DEBIT  types  : withdrawal, payment, subscription
 * SKIPPED       : deposit WITH order_ids (went straight to order settlement,
 *                 never touched wallet_balance)
 *
 * USAGE
 * ─────
 *   # Dry-run — prints a report, changes nothing
 *   node backend/scripts/audit-double-deposits.js
 *
 *   # Apply corrections
 *   node backend/scripts/audit-double-deposits.js --fix
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/database');

const User        = require('../models/User.model');
const Transaction = require('../models/Transaction.model');

const FIX_MODE = process.argv.includes('--fix');

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-CM') + ' XAF';
}

// Types that credited wallet_balance when completed.
// deposit WITH order_ids goes to settleOrdersInSession, never $inc wallet_balance.
function isCredit(tx) {
  if (tx.type === 'deposit') return !tx.order_ids?.length;
  return ['refund', 'payout', 'escrow_release'].includes(tx.type);
}

// Types that debited wallet_balance when completed.
function isDebit(tx) {
  return ['withdrawal', 'payment', 'subscription'].includes(tx.type);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  await connectDB();
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  DOUBLE-DEPOSIT AUDIT  ${FIX_MODE ? '[FIX MODE]' : '[DRY-RUN — pass --fix to apply]'}`);
  console.log(`${'─'.repeat(70)}\n`);

  // Load all completed gateway deposit user IDs so we only scan affected users.
  const affectedUserIds = await Transaction.distinct('user_id', {
    type: 'deposit',
    status: 'completed',
    gateway: { $in: ['payunit', 'eversend'] },
    order_ids: { $size: 0 },  // pure wallet deposits only
  });

  console.log(`Users with completed gateway deposits: ${affectedUserIds.length}\n`);

  const flagged   = [];  // users whose balance exceeds ledger total
  const unmatched = [];  // excess that doesn't match any single deposit amount

  let processed = 0;

  for (const userId of affectedUserIds) {
    processed++;
    if (processed % 100 === 0) process.stdout.write(`\r  Processing ${processed}/${affectedUserIds.length}...`);

    // Fetch the user and all their completed transactions in one go.
    const [user, txs] = await Promise.all([
      User.findById(userId).select('name email wallet_balance').lean(),
      Transaction.find({ user_id: userId, status: 'completed' })
        .select('type amount order_ids gateway reference createdAt')
        .lean(),
    ]);

    if (!user) continue;

    let credits = 0;
    let debits  = 0;

    for (const tx of txs) {
      if (isCredit(tx)) credits += tx.amount;
      else if (isDebit(tx)) debits += tx.amount;
    }

    // NOTE ON THE 50 XAF MOBILE MONEY COLLECTION FEE
    // ─────────────────────────────────────────────────
    // PayUnit/Eversend deposits store Transaction.amount = feeBreakdown.netAmount
    // (what actually lands in the wallet). The 50 XAF collection fee is charged
    // to the user's phone but is NOT stored in Transaction.amount and is NOT
    // added to wallet_balance. So the fee never affects this calculation.
    //
    // However, to guard against any historic data inconsistency where the fee
    // may have been miscalculated, we skip any excess that is a small multiple
    // of 50 XAF (≤ the number of the user's gateway deposits × 50). Those are
    // fee-rounding artefacts, not genuine double credits.
    const gatewayDepositCount = txs.filter(
      tx => tx.type === 'deposit' && !tx.order_ids?.length
        && ['payunit', 'eversend'].includes(tx.gateway)
    ).length;
    const feeNoiseThreshold = Math.max(1, gatewayDepositCount * 50);

    const expectedBalance = Math.max(0, credits - debits);
    const actualBalance   = user.wallet_balance || 0;
    const excess          = actualBalance - expectedBalance;

    // Skip floating-point drift AND fee-rounding noise.
    if (excess <= feeNoiseThreshold) continue;

    // Try to match the excess to one or more gateway deposits.
    const gatewayDeposits = txs.filter(
      tx => tx.type === 'deposit' && !tx.order_ids?.length
        && ['payunit', 'eversend'].includes(tx.gateway)
    );

    const matchedDeposit = gatewayDeposits.find(
      tx => Math.abs(tx.amount - excess) <= 1
    );

    flagged.push({
      userId:    user._id.toString(),
      name:      user.name || '—',
      email:     user.email || '—',
      actual:    actualBalance,
      expected:  expectedBalance,
      excess,
      matchedDeposit: matchedDeposit
        ? { ref: matchedDeposit.reference, amount: matchedDeposit.amount, gateway: matchedDeposit.gateway, date: matchedDeposit.createdAt }
        : null,
    });

    if (!matchedDeposit) {
      unmatched.push({ userId: user._id.toString(), excess });
    }
  }

  process.stdout.write('\r' + ' '.repeat(50) + '\r'); // clear progress line

  // ── Report ─────────────────────────────────────────────────────────────────

  console.log(`Scan complete. ${flagged.length} user(s) with excess balance.\n`);

  if (flagged.length === 0) {
    console.log('  ✓ No double-credited deposits found.\n');
    process.exit(0);
  }

  // Print each flagged user.
  for (const f of flagged) {
    console.log(`  User: ${f.name} <${f.email}> (${f.userId})`);
    console.log(`    Actual balance  : ${fmt(f.actual)}`);
    console.log(`    Expected balance: ${fmt(f.expected)}`);
    console.log(`    Excess (overrun): ${fmt(f.excess)}`);
    if (f.matchedDeposit) {
      const d = f.matchedDeposit;
      console.log(`    Likely doubled  : ${d.gateway} deposit of ${fmt(d.amount)} — ref ${d.ref} (${new Date(d.date).toISOString().slice(0, 10)})`);
    } else {
      console.log(`    Likely doubled  : (could not match to a single deposit — manual review needed)`);
    }
    console.log();
  }

  // Summary totals.
  const totalExcess = flagged.reduce((s, f) => s + f.excess, 0);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  Total users flagged    : ${flagged.length}`);
  console.log(`  Total excess to reclaim: ${fmt(totalExcess)}`);
  console.log(`  Unmatched (manual)     : ${unmatched.length}`);
  console.log(`${'─'.repeat(70)}\n`);

  // ── Fix ────────────────────────────────────────────────────────────────────

  if (!FIX_MODE) {
    console.log('  DRY-RUN: no changes made. Re-run with --fix to apply corrections.\n');
    process.exit(0);
  }

  console.log('  Applying corrections...\n');

  let fixed   = 0;
  let skipped = 0;

  for (const f of flagged) {
    try {
      // Re-read the user inside the loop to guard against concurrent changes.
      const fresh = await User.findById(f.userId).select('wallet_balance').lean();
      if (!fresh) { skipped++; continue; }

      const currentExcess = fresh.wallet_balance - f.expected;
      if (currentExcess <= 1) {
        console.log(`    SKIP  ${f.email}: balance already corrected`);
        skipped++;
        continue;
      }

      // Deduct exactly the excess that was double-credited.
      await User.findByIdAndUpdate(
        f.userId,
        { $inc: { wallet_balance: -currentExcess } },
        { runValidators: true }
      );

      console.log(`    FIXED ${f.email}: deducted ${fmt(currentExcess)} (${fmt(fresh.wallet_balance)} → ${fmt(Math.max(0, fresh.wallet_balance - currentExcess))})`);
      fixed++;
    } catch (err) {
      console.error(`    ERROR ${f.email}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n  Done. Fixed: ${fixed}  Skipped/Errors: ${skipped}\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('\n[audit-double-deposits] fatal:', err);
  process.exit(1);
});
