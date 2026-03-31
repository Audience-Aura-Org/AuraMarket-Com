const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  console.log('🚀 [1/5] Initiating Global Build Context...');
  const root = process.cwd();
  const webDir = path.join(root, 'aura-market/web');

  // Build the app
  execSync('cd aura-market/web && npm install && npm run build', { stdio: 'inherit' });

  console.log('📦 [2/5] Extraction & Stealth Proxying...');
  
  // 1. Move the monorepo-level standalone build results to root
  const rootStandalone = path.join(webDir, '.next/standalone');
  if (fs.existsSync(rootStandalone)) {
     console.log('Mirroring Standalone files...');
     execSync(`cp -rf ${rootStandalone}/* .`);
  }

  // 2. Flatten monorepo structure (find and move internal server.js)
  const deepStandalone = path.join(webDir, '.next/standalone/aura-market/web');
  if (fs.existsSync(deepStandalone)) {
     console.log('Flattening deepest server node...');
     execSync(`cp -rf ${deepStandalone}/* .`);
  }

  // 3. THE STEALTH SWAP: Rename official server and place our Wrapper
  if (fs.existsSync('server.js')) {
    console.log('Swapping for Stealth Boost Wrapper...');
    fs.renameSync('server.js', 'next-server.js');
    
    const wrapper = `
const path = require('path');
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || 3000;
process.env.HOSTNAME = '0.0.0.0';
console.log('--- AURA STEALTH SERVER ONLINE ---');
console.log('📡 Port: ' + process.env.PORT);
try {
  require('./next-server.js');
} catch (err) {
  console.error('❌ CRASH: ', err);
  process.exit(1);
}
    `;
    fs.writeFileSync('server.js', wrapper.trim());
  }

  console.log('🖼️ [3/5] SYNCing Browser Assets...');
  if (!fs.existsSync('.next')) fs.mkdirSync('.next');
  execSync(`cp -rf ${path.join(webDir, '.next/static')} .next/static`);
  execSync(`cp -rf ${path.join(webDir, 'public')} ./public`);

  console.log('🧪 [4/5] Self-Diagnostic Status Check...');
  ['server.js', 'next-server.js', 'node_modules', '.next/static', 'public'].forEach(f => {
    console.log(`${fs.existsSync(f) ? '✅' : '❌'} ${f}`);
  });

  console.log('🏁 [5/5] --- AURA_STEALTH_SUCCESS ---');
  process.exit(0);

} catch (err) {
  console.error('💥 FATAL ERROR IN DEPLOYER');
  console.error(err);
  process.exit(1);
}
