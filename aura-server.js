const path = require('path');

// 🛡️ AURA SIGNAL-BOOST WRAPPER
// This ensures Next.js binds to the exact port Hostinger provides.

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || 3000;
process.env.HOSTNAME = '0.0.0.0';

console.log('--- AURA MASTER SERVER STARTING ---');
console.log(`📡 Binding to Port: ${process.env.PORT}`);

try {
  // Delegate to the actual standalone Next.js server
  require('./server.js');
  console.log('🚀 Aura Master Server is Online and Connected!');
} catch (err) {
  console.error('❌ FATAL: Aura Master Server failed to start.');
  console.error(err);
  process.exit(1);
}
