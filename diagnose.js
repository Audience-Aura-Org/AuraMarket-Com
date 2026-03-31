const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  console.log('[1/4] Starting Deep Build...');
  const root = process.cwd();
  const webDir = path.join(root, 'aura-market/web');

  // Build the app
  execSync('cd aura-market/web && npm install && npm run build', { stdio: 'inherit' });

  console.log('[2/4] Constructing Atomic Runtime...');
  
  // 1. Copy the "Brain" (global node_modules of the standalone build)
  const rootStandalone = path.join(webDir, '.next/standalone');
  if (fs.existsSync(rootStandalone)) {
     console.log('Pushing standalone brain to root...');
     execSync(`cp -rn ${rootStandalone}/* .`); // r=recursive, n=no-overwrite if exists
  }

  // 2. Resolve Monorepo Deep Server (Next.js quirk)
  const deepStandalone = path.join(webDir, '.next/standalone/aura-market/web');
  if (fs.existsSync(deepStandalone)) {
     console.log('Detected Deep Monorepo Server. Flattening...');
     execSync(`cp -rf ${deepStandalone}/* .`); // f=force overwrite to move server.js to root
  }

  console.log('[3/4] SYNCing Assets...');
  if (!fs.existsSync('.next')) fs.mkdirSync('.next');
  execSync(`cp -rf ${path.join(webDir, '.next/static')} .next/static`);
  execSync(`cp -rf ${path.join(webDir, 'public')} .`);

  console.log('[4/4] Final Verification...');
  if (fs.existsSync('server.js')) {
    console.log('--- AURA_FULL_BRAIN_READY ---');
  } else {
    throw new Error('Fatal: server.js not found at surface.');
  }

  process.exit(0);

} catch (err) {
  console.error('--- AURA_DEPLOY_FAILED ---');
  console.error(err);
  process.exit(1);
}
