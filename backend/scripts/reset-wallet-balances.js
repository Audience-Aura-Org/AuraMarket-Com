/**
 * Reset every user wallet to 0 XAF (test balances before launch).
 *
 *   node scripts/reset-wallet-balances.js           # dry run: lists what would change
 *   node scripts/reset-wallet-balances.js --apply   # backs up, then resets
 *
 * Each wallet is reset in its own database transaction, together with a
 * completed "Balance reset" debit in its history and an audit entry, so the
 * ledger agrees with the balance and reconcile-wallet-balances.js keeps it at 0.
 * Only touches a wallet whose balance has not changed since it was read.
 * The platform wallet (PlatformSettings.platform_wallet_balance) is not touched.
 * A JSON backup of the previous balances is written to backend/backups/ first.
 */
'use strict';
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const { recordAudit } = require('../utils/auditTrail');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ wallet_balance: { $exists: true, $ne: 0 } }).select('name email role wallet_balance').lean();
  const total = users.reduce((s, u) => s + (u.wallet_balance || 0), 0);
  console.log(`Database: ${mongoose.connection.db.databaseName}`);
  console.log(`Wallets to reset: ${users.length} · total ${total.toLocaleString('en-US')} XAF`);
  users.forEach((u) => console.log(`  ${String(u.role).padEnd(10)} ${String(u.wallet_balance).padStart(10)} XAF  ${u.name || ''} <${u.email || ''}>`));
  if (!apply) { console.log('Dry run. Re-run with --apply to reset.'); await mongoose.disconnect(); return; }

  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `wallet-balances-before-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ database: mongoose.connection.db.databaseName, at: new Date(), users }, null, 2));
  console.log(`Backup written: ${file}`);

  let reset = 0;
  for (const u of users) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const updated = await User.findOneAndUpdate({ _id: u._id, wallet_balance: u.wallet_balance }, { $set: { wallet_balance: 0 } }, { session, returnDocument: 'after' });
        if (!updated) throw new Error('balance changed since it was read; skipped');
        const amount = Math.abs(u.wallet_balance);
        await Transaction.create([{
          user_id: u._id,
          // A positive balance is removed with a debit; a negative one is cleared with a credit.
          type: u.wallet_balance > 0 ? 'withdrawal' : 'deposit',
          amount,
          reference: `RESET-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          status: 'completed',
          description: 'Balance reset to 0 by Auradime (test balance removed before launch)',
          gateway: 'manual',
          currency: 'XAF',
          metadata: { wallet_reset: true, previous_balance: u.wallet_balance },
        }], { session });
        await recordAudit({ actorId: u._id, action: 'wallet_reset', targetType: 'User', targetId: u._id, before: { wallet_balance: u.wallet_balance }, after: { wallet_balance: 0 }, session, meta: { reason: 'test balances reset before launch' } });
      });
      reset++;
      console.log(`  reset ${u.email || u._id} (${u.wallet_balance} → 0)`);
    } catch (e) {
      console.error(`  ! ${u.email || u._id}: ${e.message}`);
    } finally {
      await session.endSession();
    }
  }
  console.log(`Done: ${reset} of ${users.length} wallets reset.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
