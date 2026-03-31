const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  console.log('[1/4] Starting Deep Build...');
  execSync('cd aura-market/web && npm install && npm run build', { stdio: 'inherit' });

  const root = process.cwd();
  const webDir = path.join(root, 'aura-market/web');

  console.log('[2/4] Mirroring Static Assets...');
  if (fs.existsSync(path.join(webDir, '.next/static'))) {
    if (!fs.existsSync('.next')) fs.mkdirSync('.next');
    execSync(`cp -r ${path.join(webDir, '.next/static')} .next/static`);
  }

  console.log('[3/4] Mirroring Public Directory...');
  if (fs.existsSync(path.join(webDir, 'public'))) {
    execSync(`cp -r ${path.join(webDir, 'public')} .`);
  }

  console.log('[4/4] Finalizing Standalone Server...');
  if (fs.existsSync(path.join(webDir, '.next/standalone'))) {
    execSync(`cp -r ${path.join(webDir, '.next/standalone')} .`);
  }

  console.log('--- AURA_DEPLOY_READY ---');
  process.exit(0);

} catch (err) {
  console.error('--- AURA_DEPLOY_FAILED ---');
  console.error(err);
  process.exit(1);
}
