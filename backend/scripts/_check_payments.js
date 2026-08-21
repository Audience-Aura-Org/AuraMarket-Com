require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.model');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL);
  console.log('DB connected\n');

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const txns = await Transaction.find({
    gateway: { $in: ['payunit', 'eversend'] },
    status: { $in: ['failed', 'pending'] },
    createdAt: { $gte: since },
  })
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();

  for (const t of txns) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`STATUS : ${t.status.toUpperCase()}`);
    console.log(`GATEWAY: ${t.gateway}  TYPE: ${t.type}  AMOUNT: ${t.amount} XAF`);
    console.log(`REF    : ${t.reference}`);
    console.log(`CREATED: ${t.createdAt.toISOString()}`);
    console.log(`META   : ${JSON.stringify(t.metadata || {})}`);

    const gwr = t.gateway_response || {};
    const makepayment = gwr.makepayment?.data || gwr.makepayment;
    const initialize  = gwr.initialize?.data  || gwr.initialize;

    if (initialize) {
      console.log(`INIT   : status=${gwr.initialize?.status} msg="${gwr.initialize?.message}"`);
      if (initialize.transaction_id) console.log(`         tx_id=${initialize.transaction_id}`);
    }
    if (makepayment) {
      console.log(`MAKEPAY: payment_status=${makepayment.payment_status || makepayment.transaction_status} msg="${gwr.makepayment?.message}"`);
      if (makepayment.transaction_id) console.log(`         tx_id=${makepayment.transaction_id}`);
    }
    // For flat (non-nested) gateway_response (webhook / verify path):
    if (!initialize && !makepayment) {
      const flat = JSON.stringify(t.gateway_response || {}).slice(0, 300);
      console.log(`GW_RESP: ${flat}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n\nDone.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
