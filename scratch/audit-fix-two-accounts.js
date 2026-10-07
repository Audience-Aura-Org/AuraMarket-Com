/**
 * scratch/audit-fix-two-accounts.js
 * Audit and fix balances for:
 *   - ashoctavia118@gmail.com  → set to 4000 XAF
 *   - uniquevoss@gmail.com     → set to 0 XAF
 *
 * Usage:
 *   node scratch/audit-fix-two-accounts.js --dry-run   # preview only
 *   node scratch/audit-fix-two-accounts.js              # apply fixes
 */

'use strict';

const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });

const mongoose = require('mongoose');

const User = require(path.join(backendDir, 'models', 'User.model'));
const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));

const DRY_RUN = process.argv.includes('--dry-run');

const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW= '\x1b[33m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';

// Types that INCREASE the user's balance
const CREDIT_TYPES = new Set(['deposit', 'refund', 'escrow_release', 'payout']);
// Types that DECREASE the user's balance
const DEBIT_TYPES  = new Set(['payment', 'withdrawal', 'subscription']);
// Gateways whose 'payment' transactions do NOT debit the user's wallet
const NON_WALLET_PAYMENT_GATEWAYS = new Set(['eversend', 'payunit', 'pawapay', 'platform']);

const ACCOUNTS = [
  { email: 'ashoctavia118@gmail.com', targetBalance: 29500 },
  { email: 'uniquevoss@gmail.com',    targetBalance: 0 },
];

async function computeLedgerBalance(userId) {
  const txns = await Transaction.find({
    user_id: userId,
    status: 'completed',
  }).select('type amount gateway reference description createdAt').lean();

  let balance = 0;
  const details = [];

  for (const tx of txns) {
    let effect = 0;
    if (CREDIT_TYPES.has(tx.type)) {
      effect = tx.amount;
      balance += tx.amount;
    } else if (DEBIT_TYPES.has(tx.type)) {
      if (tx.type === 'payment' && NON_WALLET_PAYMENT_GATEWAYS.has(tx.gateway)) {
        details.push({ ...tx, effect: 0, note: 'SKIPPED (non-wallet gateway)' });
        continue;
      }
      effect = -tx.amount;
      balance -= tx.amount;
    }
    details.push({ ...tx, effect, runningBalance: balance });
  }

  return { balance: Math.round(balance), txns, details };
}

async function auditAndFix(email, targetBalance) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${BOLD}${CYAN}  AUDITING: ${email}${RESET}`);
  console.log(`  Target balance: ${targetBalance} XAF`);
  console.log(`${'═'.repeat(70)}`);

  const user = await User.findOne({ email }).select('_id name email wallet_balance role').lean();
  if (!user) {
    console.log(`${RED}  USER NOT FOUND${RESET}`);
    return;
  }

  console.log(`  User ID:    ${user._id}`);
  console.log(`  Name:       ${user.name}`);
  console.log(`  Role:       ${user.role}`);
  console.log(`  Stored balance: ${user.wallet_balance} XAF`);

  // Compute ledger balance
  const { balance: ledgerBalance, txns, details } = await computeLedgerBalance(user._id);

  console.log(`  Ledger balance: ${ledgerBalance} XAF`);
  console.log(`  Target balance: ${targetBalance} XAF`);

  // Show all transactions
  console.log(`\n  ${BOLD}Transaction Ledger (${txns.length} completed):${RESET}`);
  console.log(`  ${'─'.repeat(66)}`);

  for (const d of details) {
    const sign = d.effect > 0 ? GREEN + '+' : d.effect < 0 ? RED : DIM;
    const effectStr = d.effect !== 0 ? `${sign}${d.effect}${RESET}` : `${DIM}0${RESET}`;
    const date = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 16) : '?';
    const desc = (d.description || '').slice(0, 50);
    console.log(`  ${DIM}${date}${RESET}  ${d.type.padEnd(15)} ${effectStr.padStart(20)}  ${DIM}${d.gateway || '-'}${RESET}  ${desc}`);
    if (d.note) console.log(`    ${YELLOW}↳ ${d.note}${RESET}`);
  }

  // Show pending transactions
  const pendingTxns = await Transaction.find({
    user_id: user._id,
    status: 'pending',
  }).select('type amount reference description createdAt').lean();

  if (pendingTxns.length > 0) {
    console.log(`\n  ${YELLOW}Pending transactions (${pendingTxns.length}):${RESET}`);
    for (const t of pendingTxns) {
      const date = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 16) : '?';
      console.log(`    ${YELLOW}${date}  ${t.type.padEnd(15)} ${t.amount}  ${t.description || t.reference}${RESET}`);
    }
  }

  // Discrepancies
  console.log(`\n  ${BOLD}Analysis:${RESET}`);
  const storedVsLedger = user.wallet_balance - ledgerBalance;
  const storedVsTarget = user.wallet_balance - targetBalance;
  const ledgerVsTarget = ledgerBalance - targetBalance;

  console.log(`  Stored vs Ledger: ${storedVsLedger === 0 ? GREEN + 'MATCH' : RED + storedVsLedger + ' XAF discrepancy'}${RESET}`);
  console.log(`  Stored vs Target: ${storedVsTarget === 0 ? GREEN + 'MATCH' : RED + storedVsTarget + ' XAF discrepancy'}${RESET}`);
  console.log(`  Ledger vs Target: ${ledgerVsTarget === 0 ? GREEN + 'MATCH' : YELLOW + ledgerVsTarget + ' XAF discrepancy'}${RESET}`);

  // Apply fix
  if (user.wallet_balance === targetBalance) {
    console.log(`\n  ${GREEN}✓ Balance is already correct. No fix needed.${RESET}`);
    return;
  }

  const delta = targetBalance - user.wallet_balance;
  console.log(`\n  ${BOLD}Fix: ${delta > 0 ? 'Credit' : 'Debit'} ${Math.abs(delta)} XAF to reach target of ${targetBalance} XAF${RESET}`);

  if (DRY_RUN) {
    console.log(`  ${YELLOW}[DRY RUN] Skipping write.${RESET}`);
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await User.findByIdAndUpdate(
      user._id,
      { $set: { wallet_balance: targetBalance } },
      { session }
    );

    await Transaction.create([{
      user_id: user._id,
      type: delta > 0 ? 'refund' : 'payment',
      amount: Math.abs(delta),
      status: 'completed',
      gateway: 'platform',
      reference: `ADMIN-BALANCE-FIX-${user._id.toString().slice(-6).toUpperCase()}-${Date.now()}`,
      description: `Admin balance correction: ${user.wallet_balance} → ${targetBalance} XAF (audit fix, delta ${delta > 0 ? '+' : ''}${delta})`,
      metadata: {
        admin_balance_adjustment: true,
        previous_balance: user.wallet_balance,
        new_balance: targetBalance,
        ledger_balance: ledgerBalance,
        reason: 'Manual audit correction',
      },
    }], { session });

    await session.commitTransaction();
    console.log(`  ${GREEN}✓ Balance updated: ${user.wallet_balance} → ${targetBalance} XAF${RESET}`);

    // Verify
    const updated = await User.findById(user._id).select('wallet_balance').lean();
    console.log(`  ${GREEN}✓ Verified: wallet_balance = ${updated.wallet_balance} XAF${RESET}`);
  } catch (err) {
    await session.abortTransaction();
    console.error(`  ${RED}✗ Failed: ${err.message}${RESET}`);
  } finally {
    session.endSession();
  }
}

async function main() {
  console.log(BOLD + `\nAuradime — Account Balance Audit & Fix` + RESET);
  console.log(DIM + `Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}` + RESET);
  console.log(DIM + `Connecting to MongoDB…` + RESET);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
  });
  console.log(DIM + `Connected.\n` + RESET);

  for (const account of ACCOUNTS) {
    await auditAndFix(account.email, account.targetBalance);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(BOLD + 'Done.' + RESET);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(2);
});
