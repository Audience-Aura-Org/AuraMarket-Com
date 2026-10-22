/**
 * scripts/legacy-withdrawals.js
 * Auradime — Find and refund withdrawals stranded by the retired
 * POST /wallet/withdraw endpoint.
 *
 * Background:
 *   That endpoint debited the user's wallet and wrote a pending 'withdrawal'
 *   Transaction, but never created a WithdrawalRequest — so the payout never
 *   appeared in the admin queue and the money sat in limbo. Refunding returns
 *   it to the wallet and notifies the user to request it again through the
 *   admin-reviewed flow (POST /withdrawals).
 *
 * Safe to run on a live database:
 *   - DRY RUN BY DEFAULT: lists what it found and changes nothing.
 *   - --refund performs the refunds, each in its own DB transaction.
 *   - Idempotent: a withdrawal is refunded at most once, even if re-run.
 *   - Only matches the legacy signature (see services/legacyWithdrawals.service).
 *
 * Usage:
 *   node scripts/legacy-withdrawals.js            # list only (no writes)
 *   node scripts/legacy-withdrawals.js --refund   # refund every one listed
 */
'use strict';

require('../config/env');
const mongoose = require('mongoose');
const {
  findLegacyPendingWithdrawals,
  refundLegacyWithdrawal,
} = require('../services/legacyWithdrawals.service');

const REFUND = process.argv.includes('--refund');

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const xaf = (n) => `${Number(n || 0).toLocaleString()} XAF`;

async function main() {
  console.log(BOLD + '\nAuradime — Stranded legacy withdrawals' + RESET);
  console.log(DIM + `Mode: ${REFUND ? 'REFUND (will update DB)' : 'DRY RUN (no writes)'}` + RESET);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });

  const rows = await findLegacyPendingWithdrawals();
  if (!rows.length) {
    console.log(GREEN + '\nNone found. Nothing to do.\n' + RESET);
    return;
  }

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  console.log(`\nFound ${rows.length} withdrawal(s) totalling ${BOLD}${xaf(total)}${RESET}:\n`);
  for (const r of rows) {
    const who = r.user?.email || r.user?._id;
    console.log(`  ${r.reference}  ${xaf(r.amount).padStart(14)}  ${new Date(r.createdAt).toISOString().slice(0, 10)}  ${who}  ${DIM}${r.description || ''}${RESET}`);
  }

  if (!REFUND) {
    console.log(YELLOW + '\nDry run — nothing changed. Re-run with --refund to return these amounts to the users.\n' + RESET);
    return;
  }

  let refunded = 0;
  let skipped = 0;
  for (const r of rows) {
    try {
      const out = await refundLegacyWithdrawal(r._id);
      if (out.refunded) {
        refunded += 1;
        console.log(GREEN + `  ✓ ${r.reference} refunded ${xaf(out.amount)} → balance ${xaf(out.balance)}` + RESET);
      } else {
        skipped += 1;
        console.log(DIM + `  – ${r.reference} skipped (${out.reason})` + RESET);
      }
    } catch (err) {
      skipped += 1;
      console.log(RED + `  ✗ ${r.reference} failed: ${err.message}` + RESET);
    }
  }
  console.log(BOLD + `\nDone: ${refunded} refunded, ${skipped} skipped.\n` + RESET);
}

// Exit explicitly: shared modules (Redis, S3 client) keep the event loop alive.
main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(RED + err.stack + RESET);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
