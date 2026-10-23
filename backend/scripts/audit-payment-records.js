'use strict';

// Read-only consistency checks. No application startup, models, jobs, index writes, or gateway calls.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const { MongoClient } = require('mongoose').mongo;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('DATABASE_NOT_CONFIGURED');
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred', serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();
    const transactions = db.collection('transactions');
    const since = new Date(Date.now() - 30 * 86400000);
    const recent = { createdAt: { $gte: since } };
    const gateways = ['payunit', 'pawapay', 'eversend'];
    const aggregate = pipeline => transactions.aggregate(pipeline, { maxTimeMS: 15000 }).toArray();
    const count = async pipeline => (await aggregate([...pipeline, { $count: 'count' }]))[0]?.count || 0;
    const results = { checkedAt: new Date().toISOString(), windowDays: 30 };
    results.transactionSummary = await aggregate([{ $match: recent }, { $group: { _id: { gateway: '$gateway', status: '$status', currency: '$currency' }, count: { $sum: 1 } } }]);
    results.oldPendingCollections = await transactions.countDocuments({ gateway: { $in: gateways }, status: { $in: ['pending', 'processing'] }, createdAt: { $lt: new Date(Date.now() - 86400000) } }, { maxTimeMS: 15000 });
    results.oldPendingCollectionModes = await aggregate([{ $match: { gateway: { $in: gateways }, status: { $in: ['pending', 'processing'] }, createdAt: { $lt: new Date(Date.now() - 86400000) } } }, { $group: { _id: { gateway: '$gateway', sandbox: { $ifNull: ['$metadata.is_sandbox', false] } }, count: { $sum: 1 } } }]);
    results.pendingCollectionsWithoutProviderId = await transactions.countDocuments({ ...recent, gateway: { $in: gateways }, status: { $in: ['pending', 'processing'] }, gateway_transaction_id: null }, { maxTimeMS: 15000 });
    results.completedNetAmountMismatch = await count([{ $match: { ...recent, status: 'completed', gateway: { $in: gateways }, 'metadata.net_amount': { $exists: true } } }, { $match: { $expr: { $ne: ['$amount', '$metadata.net_amount'] } } }]);
    results.completedCheckoutWithUnpaidOrders = await count([{ $match: { ...recent, status: 'completed', 'order_ids.0': { $exists: true } } }, { $lookup: { from: 'orders', localField: 'order_ids', foreignField: '_id', as: 'linked_orders' } }, { $match: { linked_orders: { $elemMatch: { payment_status: { $nin: ['paid', 'refunded'] } } } } }]);
    results.completedSubscriptionsWithoutLinkedActivation = await count([{ $match: { ...recent, type: 'subscription', status: 'completed' } }, { $lookup: { from: 'usersubscriptions', localField: '_id', foreignField: 'payment_transaction_id', as: 'activation' } }, { $match: { 'activation.0': { $exists: false } } }]);
    results.nonXafWalletCollections = await transactions.countDocuments({ ...recent, type: 'deposit', gateway: { $in: gateways }, status: 'completed', currency: { $nin: ['XAF', null] } }, { maxTimeMS: 15000 });
    results.negativeWalletBalances = await db.collection('users').countDocuments({ wallet_balance: { $lt: 0 } }, { maxTimeMS: 15000 });
    results.walletAuditRecords = await db.collection('auditlogs').countDocuments({ ...recent, action: { $in: ['wallet_credit', 'wallet_debit'] } }, { maxTimeMS: 15000 });
    if (process.argv.includes('--provider-status')) {
      results.providerStatusChecks = { checked: 0, statuses: {} };
      if (process.env.PAWAPAY_SANDBOX_MODE === 'true' || !process.env.PAWAPAY_API_TOKEN) {
        results.providerStatusChecks.unavailable = 'Live provider credentials are not configured.';
      } else {
        const gateway = require('../services/payment/gateways/pawapay.gateway');
        const pending = await transactions.find({ gateway: 'pawapay', status: { $in: ['pending', 'processing'] }, 'metadata.is_sandbox': { $ne: true }, createdAt: { $lt: new Date(Date.now() - 86400000) } }, { projection: { gateway_transaction_id: 1, metadata: 1 } }).toArray();
        for (const transaction of pending) {
          const id = transaction.gateway_transaction_id || transaction.metadata?.depositId;
          if (!id) continue;
          try {
            // This exported method performs GET only; settlement/recheck controllers are never called.
            const response = await gateway.getDepositStatus(id);
            const status = String(response?.status || 'UNKNOWN');
            results.providerStatusChecks.checked++;
            results.providerStatusChecks.statuses[status] = (results.providerStatusChecks.statuses[status] || 0) + 1;
          } catch (error) {
            results.providerStatusChecks.unavailable = 'Provider lookup failed: ' + (error.response?.status || error.code || error.name);
            break;
          }
        }
      }
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await client.close(); }
}

main().catch(error => { console.error('Read-only payment audit failed:', error.code || error.name); process.exitCode = 1; });
