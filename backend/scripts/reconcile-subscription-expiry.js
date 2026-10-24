'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const { MongoClient } = require('mongoose').mongo;
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect(); const db = client.db(); const now = new Date();
    const filter = { status: 'active', expires_at: { $ne: null, $lte: now } };
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ mode: 'dry-run', expiredActiveRecords: await db.collection('usersubscriptions').countDocuments(filter), walletTransfer: 0 }));
      return;
    }
    const session = client.startSession(); let changed = 0;
    try {
      await session.withTransaction(async () => {
        changed = 0;
        const rows = await db.collection('usersubscriptions').find(filter, { session }).toArray();
        for (const row of rows) {
          const result = await db.collection('usersubscriptions').updateOne({ _id: row._id, ...filter }, {
            $set: { status: 'expired', updatedAt: now },
            $push: { history: { action: 'expired', note: 'Expiry status reconciled during the subscription audit; no funds moved.', at: now } },
          }, { session });
          if (result.modifiedCount) {
            await db.collection('subscriptionauditrecords').insertOne({
              action: 'expired_status_reconciled', target_id: row._id, actor_type: 'system_maintenance',
              authorization: 'operator_requested_subscription_audit', before: row,
              after: { status: 'expired' }, wallet_transfer: 0, createdAt: now,
            }, { session });
            changed++;
          }
        }
      });
    } finally { await session.endSession(); }
    console.log(JSON.stringify({ mode: 'applied', changed, walletTransfer: 0 }));
  } finally { await client.close(); }
})().catch(error => { console.error(error.name + ': subscription expiry reconciliation failed'); process.exitCode = 1; });
