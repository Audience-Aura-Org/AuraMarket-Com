'use strict';
// Dry-run by default. Run with --apply during deployment before enabling push.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const { MongoClient } = require('mongoose').mongo;
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect(); const collection = client.db().collection('pushsubscriptions');
    const indexes = await collection.indexes();
    const legacy = indexes.find(index => index.unique && index.sparse && Object.keys(index.key).length === 2 && index.key.user_id === 1 && index.key.fcm_token === 1);
    const apply = process.argv.includes('--apply');
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', legacyIndex: legacy?.name || null, replacement: 'push_android_user_token_unique' }));
    if (apply) {
      await collection.createIndex({user_id:1,fcm_token:1},{name:'push_android_user_token_unique',unique:true,partialFilterExpression:{fcm_token:{$type:'string'}}});
      if (legacy) await collection.dropIndex(legacy.name);
      console.log('Push token index ready. No subscriptions were deleted.');
    }
  } finally { await client.close(); }
})().catch(error => { console.error(error.message); process.exitCode=1; });
