const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  console.log('[1/4] Starting Deep Build...');
  const root = process.cwd();
  const webDir = path.join(root, 'aura-market/web');

  // Build the app
  execSync('cd aura-market/web && npm install && npm run build', { stdio: 'inherit' });

  console.log('[2/4] Constructing Standalone Runtime...');
  
  // 1. Copy the standalone engine (everything inside it)
  if (fs.existsSync(path.join(webDir, '.next/standalone'))) {
    // Specifically target the standalone/aura-market/web folder if it exists (Next.js monorepo quirk)
    const deepStandalone = path.join(webDir, '.next/standalone/aura-market/web');
    if (fs.existsSync(deepStandalone)) {
       execSync(`cp -r ${deepStandalone}/* .`);
    } else {
       execSync(`cp -r ${path.join(webDir, '.next/standalone')}/* .`);
    }
  }

  console.log('[3/4] SYNCing Browser Assets...');
  // 2. Mirror .next/static and public (REQUIRED for CSS/Images to work)
  if (!fs.existsSync('.next')) fs.mkdirSync('.next');
  execSync(`cp -r ${path.join(webDir, '.next/static')} .next/static`);
  execSync(`cp -r ${path.join(webDir, 'public')} .`);

  console.log('[4/4] Validating Entry Node...');
  if (fs.existsSync('server.js')) {
    console.log('--- AURA_ATOMIC_READY ---');
  } else {
    console.warn('Warning: server.js not found at surface. Attempting fallback mapping.');
    // Check if it exists in one of the subdirs and bring it up
    execSync('find . -name server.js -exec cp {} . \\;');
  }

  process.exit(0);

} catch (err) {
  console.error('--- AURA_DEPLOY_FAILED ---');
  console.error(err);
  process.exit(1);
}
