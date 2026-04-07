const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('--- AURA MARKET VAPID KEYS ---');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('------------------------------');
