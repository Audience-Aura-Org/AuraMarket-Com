'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const { MongoClient, ObjectId } = require('mongoose').mongo;
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect(); const db = client.db(); const now = new Date();
    // The operator explicitly confirmed these historical admin grants were free.
    const ids = ['6a437c8609ef3c492c7bbf4d', '6a437dcf09ef3c492c7bc1c9', '6a451ec03b8bdb4a5eb10a72', '6aa7afeb7db050fe54b3250c', '6abf71a26bf71d81a96007b7', '6ac7726e388beb280b1619cc'].map(id => new ObjectId(id));
    const filter = { _id: { $in: ids }, source: 'admin', amount_paid: { $gt: 0 }, payment_transaction_id: null, payment_reference: null };
    if (!process.argv.includes('--apply')) {
      const rows = await db.collection('usersubscriptions').find(filter, { projection: { amount_paid: 1 } }).toArray();
      console.log(JSON.stringify({ mode: 'dry-run', records: rows.length, recordedAmount: rows.reduce((sum, row) => sum + row.amount_paid, 0), walletTransfer: 0 }));
      return;
    }
    const session = client.startSession(); let changed = 0, correctedAmount = 0;
    try {
      await session.withTransaction(async () => {
        changed = 0; correctedAmount = 0;
        const rows = await db.collection('usersubscriptions').find(filter, { session }).toArray();
        for (const row of rows) {
          const result = await db.collection('usersubscriptions').updateOne({ ...filter, _id: row._id }, {
            $set: { amount_paid: 0, updatedAt: now },
            $push: { history: { action: 'complimentary_reconciled', note: 'Operator confirmed complimentary admin activation. Previous catalog-price amount was not a payment. No funds moved.', at: now } },
          }, { session });
          if (result.modifiedCount) {
            await db.collection('subscriptionauditrecords').insertOne({ action: 'complimentary_amount_corrected', target_id: row._id,
              actor_type: 'operator_confirmed_maintenance', authorization: 'Operator confirmed six grants were complimentary on 2026-10-24',
              before: row, after: { amount_paid: 0 }, wallet_transfer: 0, createdAt: now,
            }, { session });
            changed++; correctedAmount += row.amount_paid;
          }
        }
      });
    } finally { await session.endSession(); }
    console.log(JSON.stringify({ mode: 'applied', changed, correctedAmount, walletTransfer: 0 }));
  } finally { await client.close(); }
})().catch(error => { console.error(error.name + ': complimentary subscription reconciliation failed'); process.exitCode = 1; });
